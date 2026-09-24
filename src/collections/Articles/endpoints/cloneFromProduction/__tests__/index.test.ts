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

  it("clone returns the new article", async () => {
    const result = { id: 9, slug: "housing-1", title: "Housing", created: { articles: 1 } }
    vi.mocked(cloneArticleFromProduction).mockResolvedValue(result)

    const res = await cloneFromProductionEndpoint.handler(request())

    expect(await res.json()).toEqual(result)
  })

  it("clone rejects a request without a slug", async () => {
    const res = await cloneFromProductionEndpoint.handler(request({ json: async () => ({}) }))
    expect(res.status).toBe(400)
  })

  it("clone maps a missing production article to 404 and other failures to 500", async () => {
    vi.mocked(cloneArticleFromProduction).mockRejectedValueOnce(new ArticleNotFoundError("gone"))
    expect((await cloneFromProductionEndpoint.handler(request())).status).toBe(404)

    vi.mocked(cloneArticleFromProduction).mockRejectedValueOnce(new Error("boom"))
    const res = await cloneFromProductionEndpoint.handler(request())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Clone failed: boom" })
  })
})
