import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Config, Payload } from "payload"

const { syncDocs } = vi.hoisted(() => ({ syncDocs: vi.fn() }))
vi.mock("../syncDocs", () => ({ syncDocs }))
vi.mock("../collection", () => ({ DOCS_SLUG: "docs", Docs: { slug: "docs", fields: [] } }))

import { docsPlugin } from ".."
import { syncVersion } from "../syncVersion"

const logger = { info: vi.fn(), error: vi.fn() }
const payload = { logger } as unknown as Payload

const start = async (env: Record<string, string>) => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const onInit = vi.fn()
  const config = (await docsPlugin()({ collections: [], onInit } as unknown as Config)) as Config
  await config.onInit?.(payload)
  await vi.waitFor(() => expect(onInit).toHaveBeenCalled())
  // Let the background sync settle.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return config
}

// As the running site: Next's Node runtime, not a build, not under Vitest.
const SITE = { NEXT_RUNTIME: "nodejs", NEXT_PHASE: "", VITEST: "", DOCS_SYNC: "" }

beforeEach(() => {
  vi.clearAllMocks()
  syncDocs.mockResolvedValue({ created: [], updated: [], unchanged: ["a"] })
})
afterEach(() => vi.unstubAllEnvs())

describe("docsPlugin", () => {
  it("adds the Docs collection", async () => {
    const config = await start({})
    expect(config.collections?.map((c) => c.slug)).toEqual(["docs"])
  })

  it("syncs the repo's docs when the site starts, and moves the cache key on a change", async () => {
    syncDocs.mockResolvedValue({ created: ["a"], updated: [], unchanged: [] })
    const before = syncVersion()
    await start(SITE)
    expect(syncDocs).toHaveBeenCalledWith(payload)
    expect(logger.info).toHaveBeenCalled()
    await vi.waitFor(() => expect(syncVersion()).not.toBe(before))
  })

  it("keeps the cache key when nothing changed", async () => {
    const before = syncVersion()
    await start(SITE)
    expect(syncDocs).toHaveBeenCalled()
    expect(syncVersion()).toBe(before)
  })

  it("logs a failed sync rather than stopping the site", async () => {
    syncDocs.mockRejectedValue(new Error("boom"))
    await start(SITE)
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled())
  })

  it.each([
    ["outside Next (the Payload CLI)", { ...SITE, NEXT_RUNTIME: "" }],
    ["during next build", { ...SITE, NEXT_PHASE: "phase-production-build" }],
    ["under tests", { ...SITE, VITEST: "true" }],
    ["with DOCS_SYNC=false", { ...SITE, DOCS_SYNC: "false" }],
  ])("doesn't sync %s", async (_, env) => {
    await start(env)
    expect(syncDocs).not.toHaveBeenCalled()
  })
})
