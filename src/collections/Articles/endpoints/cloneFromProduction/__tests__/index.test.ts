// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as Logic from "../logic"

vi.mock("../logic", async (importOriginal) => ({
  ...(await importOriginal<typeof Logic>()),
  cloneArticleFromProduction: vi.fn(),
}))
vi.mock("../source", () => ({ searchProductionArticles: vi.fn() }))

import type { PayloadRequest } from "payload"

import { cloneFromProductionEndpoint, productionSearchEndpoint } from ".."
import { ArticleNotFoundError, cloneArticleFromProduction } from "../logic"
import { searchProductionArticles } from "../source"

const admin = { id: 1, roles: ["admin"] }

/** Every NDJSON line of a streamed response, parsed. */
async function events(res: Response) {
  return (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown)
}

function request(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user: admin,
    query: {},
    json: async () => ({ slug: "housing" }),
    payload: {
      find: vi.fn().mockResolvedValue({ docs: [{ slug: "housing" }] }),
      logger: { error: vi.fn() },
    },
    ...overrides,
  } as unknown as PayloadRequest
}

describe("clone-from-production endpoints", () => {
  const originalBuildEnv = process.env.BUILD_ENV
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.BUILD_ENV
  })
  afterEach(() => {
    vi.useRealTimers()
    if (originalBuildEnv === undefined) delete process.env.BUILD_ENV
    else process.env.BUILD_ENV = originalBuildEnv
  })

  it.each([
    ["search", productionSearchEndpoint],
    ["clone", cloneFromProductionEndpoint],
  ])("%s is refused on production", async (_, endpoint) => {
    process.env.BUILD_ENV = "production"
    const res = await endpoint.handler(request())
    expect(res.status).toBe(403)
  })

  it.each([
    ["search", productionSearchEndpoint],
    ["clone", cloneFromProductionEndpoint],
  ])("%s is refused for non-admins", async (_, endpoint) => {
    const res = await endpoint.handler(request({ user: { id: 2, roles: ["editor"] } }))
    expect(res.status).toBe(401)
  })

  it("search flags articles whose slug is already taken here", async () => {
    vi.mocked(searchProductionArticles).mockResolvedValue([
      { id: 1, title: "Housing", slug: "housing" },
      { id: 2, title: "Transit", slug: "transit" },
    ])

    const res = await productionSearchEndpoint.handler(request({ query: { q: "ho" } }))

    expect(searchProductionArticles).toHaveBeenCalledWith("ho")
    expect(await res.json()).toEqual({
      docs: [
        { id: 1, title: "Housing", slug: "housing", existsLocally: true },
        { id: 2, title: "Transit", slug: "transit", existsLocally: false },
      ],
    })
  })

  it("search reports an unreachable production as 502", async () => {
    vi.mocked(searchProductionArticles).mockRejectedValue(new Error("ECONNREFUSED"))
    const res = await productionSearchEndpoint.handler(request())
    expect(res.status).toBe(502)
  })

  it("clone streams progress as documents are created, then the new article", async () => {
    const result = { id: 9, slug: "housing-1", title: "Housing", created: { articles: 1 } }
    vi.mocked(cloneArticleFromProduction).mockImplementation(async (_, slug, options) => {
      expect(slug).toBe("housing")
      options?.onProgress?.({ media: 1 })
      options?.onProgress?.({ media: 2, users: 1 })
      return result
    })

    const res = await cloneFromProductionEndpoint.handler(request())

    expect(res.headers.get("Content-Type")).toMatch(/^application\/x-ndjson/)
    expect(await events(res)).toEqual([
      { type: "progress", created: { media: 1 } },
      { type: "progress", created: { media: 2, users: 1 } },
      { type: "done", ...result },
    ])
  })

  it("clone rejects a request without a slug", async () => {
    const res = await cloneFromProductionEndpoint.handler(request({ json: async () => ({}) }))
    expect(res.status).toBe(400)
  })

  it("clone streams a missing article as an error, and logs only unexpected failures", async () => {
    const req = request()
    vi.mocked(cloneArticleFromProduction).mockRejectedValueOnce(new ArticleNotFoundError("gone"))
    expect(await events(await cloneFromProductionEndpoint.handler(req))).toEqual([
      { type: "error", message: "gone" },
    ])
    expect(req.payload.logger.error).not.toHaveBeenCalled()

    vi.mocked(cloneArticleFromProduction).mockRejectedValueOnce(new Error("boom"))
    expect(await events(await cloneFromProductionEndpoint.handler(req))).toEqual([
      { type: "error", message: "Clone failed: boom" },
    ])
    expect(req.payload.logger.error).toHaveBeenCalled()
  })

  it("clone pings while nothing new has been created, so the proxy keeps the response open", async () => {
    vi.useFakeTimers()
    let finish!: (value: Awaited<ReturnType<typeof cloneArticleFromProduction>>) => void
    vi.mocked(cloneArticleFromProduction).mockReturnValue(new Promise((r) => (finish = r)))

    const res = await cloneFromProductionEndpoint.handler(request())
    const reader = res.body!.getReader()
    const next = async () => JSON.parse(new TextDecoder().decode((await reader.read()).value))

    await vi.advanceTimersByTimeAsync(15_000)
    expect(await next()).toEqual({ type: "ping" })

    finish({ id: 9, slug: "housing", title: "Housing", created: {} })
    expect(await next()).toMatchObject({ type: "done", id: 9 })
    expect((await reader.read()).done).toBe(true)
  })

  it("clone runs to completion when the client disconnects midway", async () => {
    let progress!: () => void
    let finish!: () => void
    vi.mocked(cloneArticleFromProduction).mockImplementation(
      (_, __, options) =>
        new Promise((resolve) => {
          progress = () => options?.onProgress?.({ media: 1 })
          finish = () => resolve({ id: 9, slug: "housing", title: "Housing", created: {} })
        }),
    )
    const req = request()

    const res = await cloneFromProductionEndpoint.handler(req)
    await res.body!.cancel()
    progress()
    finish()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Writing to the closed stream would throw inside the cloner and abandon it halfway.
    expect(req.payload.logger.error).not.toHaveBeenCalled()
  })
})
