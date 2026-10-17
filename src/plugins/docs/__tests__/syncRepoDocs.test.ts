import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

const { syncDocs } = vi.hoisted(() => ({ syncDocs: vi.fn() }))
vi.mock("../syncDocs", () => ({ syncDocs }))

import { syncRepoDocs } from "../syncRepoDocs"

const logger = { info: vi.fn(), error: vi.fn() }
const payload = { logger } as unknown as Payload
const empty = { sections: [], created: [], offered: [], skipped: [], existing: [], deleted: [] }

beforeEach(() => {
  vi.clearAllMocks()
  syncDocs.mockResolvedValue({ ...empty, existing: ["a"] })
})
afterEach(() => vi.unstubAllEnvs())

describe("syncRepoDocs", () => {
  it("seeds the repo's new docs as drafts and logs them", async () => {
    const result = { ...empty, created: ["a"], existing: ["b"] }
    syncDocs.mockResolvedValue(result)
    await expect(syncRepoDocs(payload)).resolves.toEqual(result)
    expect(syncDocs).toHaveBeenCalledWith(payload)
    expect(logger.info).toHaveBeenCalledWith({ created: ["a"] }, expect.any(String))
  })

  it("logs the sections it seeded, the docs it offered changes to, and those an editor's draft held back", async () => {
    syncDocs.mockResolvedValue({ ...empty, sections: ["c"], offered: ["a"], skipped: ["b"] })
    await syncRepoDocs(payload)
    expect(logger.info).toHaveBeenCalledWith({ sections: ["c"] }, expect.any(String))
    expect(logger.info).toHaveBeenCalledWith({ offered: ["a"] }, expect.any(String))
    expect(logger.info).toHaveBeenCalledWith({ skipped: ["b"] }, expect.any(String))
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
