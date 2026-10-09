import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

const { syncDocs, purgeEdgeCache, revalidateTag } = vi.hoisted(() => ({
  syncDocs: vi.fn(),
  purgeEdgeCache: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("../syncDocs", () => ({ syncDocs }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))
vi.mock("next/cache", () => ({ revalidateTag }))

import { syncRepoDocs } from "../syncRepoDocs"

const logger = { info: vi.fn(), error: vi.fn() }
const payload = { logger } as unknown as Payload

beforeEach(() => {
  vi.clearAllMocks()
  syncDocs.mockResolvedValue({ created: [], updated: [], unchanged: ["a"] })
})
afterEach(() => vi.unstubAllEnvs())

describe("syncRepoDocs", () => {
  it("syncs the repo's docs and refreshes the caches on a change", async () => {
    const result = { created: ["a"], updated: [], unchanged: [] }
    syncDocs.mockResolvedValue(result)
    await expect(syncRepoDocs(payload)).resolves.toEqual(result)
    expect(syncDocs).toHaveBeenCalledWith(payload)
    expect(logger.info).toHaveBeenCalled()
    expect(revalidateTag).toHaveBeenCalledWith("docs", "max")
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "docs synced")
  })

  it("leaves the caches alone when nothing changed", async () => {
    await syncRepoDocs(payload)
    expect(syncDocs).toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("logs a failed sync rather than failing the deploy", async () => {
    syncDocs.mockRejectedValue(new Error("boom"))
    await expect(syncRepoDocs(payload)).resolves.toBeNull()
    expect(logger.error).toHaveBeenCalled()
  })

  it("doesn't sync with DOCS_SYNC=false", async () => {
    vi.stubEnv("DOCS_SYNC", "false")
    await expect(syncRepoDocs(payload)).resolves.toBeNull()
    expect(syncDocs).not.toHaveBeenCalled()
  })
})
