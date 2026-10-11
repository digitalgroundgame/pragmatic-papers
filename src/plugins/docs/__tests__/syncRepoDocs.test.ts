import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

const { syncDocs } = vi.hoisted(() => ({ syncDocs: vi.fn() }))
vi.mock("../syncDocs", () => ({ syncDocs }))

import { syncRepoDocs } from "../syncRepoDocs"

const logger = { info: vi.fn(), error: vi.fn() }
const payload = { logger } as unknown as Payload

beforeEach(() => {
  vi.clearAllMocks()
  syncDocs.mockResolvedValue({ created: [], existing: ["a"] })
})
afterEach(() => vi.unstubAllEnvs())

describe("syncRepoDocs", () => {
  it("seeds the repo's new docs as drafts and logs them", async () => {
    const result = { created: ["a"], existing: ["b"] }
    syncDocs.mockResolvedValue(result)
    await expect(syncRepoDocs(payload)).resolves.toEqual(result)
    expect(syncDocs).toHaveBeenCalledWith(payload)
    expect(logger.info).toHaveBeenCalledWith({ created: ["a"] }, expect.any(String))
  })

  it("logs nothing when the site has every doc already", async () => {
    await syncRepoDocs(payload)
    expect(syncDocs).toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
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
