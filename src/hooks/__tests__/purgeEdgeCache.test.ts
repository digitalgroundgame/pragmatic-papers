import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as Integrations from "@/integrations"

const { mockPurge } = vi.hoisted(() => ({ mockPurge: vi.fn() }))

vi.mock("@/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof Integrations>()
  return { ...actual, cloudflareCache: { ...actual.cloudflareCache, purge: mockPurge } }
})

const { purgeEdgeCache, flushEdgeCachePurge } = await import("../purgeEdgeCache")

const logger = { info: vi.fn(), warn: vi.fn() }

function configure(): void {
  vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone123")
  vi.stubEnv("CLOUDFLARE_PURGE_TOKEN", "token")
  vi.stubEnv("SERVER_URL", "https://pr-42.pragmaticpapers.com")
}

beforeEach(() => {
  mockPurge.mockReset().mockResolvedValue(undefined)
  logger.info.mockClear()
  logger.warn.mockClear()
})

afterEach(async () => {
  await flushEdgeCachePurge()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe("purgeEdgeCache", () => {
  it("skips with a log line naming the missing variables when unconfigured", async () => {
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "")
    vi.stubEnv("CLOUDFLARE_PURGE_TOKEN", "")

    purgeEdgeCache(logger, "site settings saved")
    await flushEdgeCachePurge()

    expect(mockPurge).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Skipping Cloudflare purge (site settings saved)"),
    )
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("set CLOUDFLARE_ZONE_ID, CLOUDFLARE_PURGE_TOKEN"),
    )
  })

  it("skips when the site runs on localhost", async () => {
    configure()
    vi.stubEnv("SERVER_URL", "http://localhost:8000")

    purgeEdgeCache(logger, "header saved")
    await flushEdgeCachePurge()

    expect(mockPurge).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("not a public hostname"))
  })

  it("purges this deployment's hostname, and logs what it purged", async () => {
    configure()

    purgeEdgeCache(logger, "site settings saved")
    await flushEdgeCachePurge()

    expect(mockPurge).toHaveBeenCalledWith({ hosts: ["pr-42.pragmaticpapers.com"] })
    expect(logger.info).toHaveBeenCalledWith(
      "Purged Cloudflare's cache for pr-42.pragmaticpapers.com (site settings saved)",
    )
  })

  it("returns before the purge is sent, then sends one request for a burst", async () => {
    vi.useFakeTimers()
    configure()

    purgeEdgeCache(logger, "article published")
    purgeEdgeCache(logger, "volume published")
    purgeEdgeCache(logger, "article published")
    expect(mockPurge).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    await flushEdgeCachePurge()

    expect(mockPurge).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(
      "Purged Cloudflare's cache for pr-42.pragmaticpapers.com (article published, volume published)",
    )
  })

  it("logs a failed purge as a warning instead of throwing", async () => {
    configure()
    mockPurge.mockRejectedValue(new Error("Cloudflare purge failed (HTTP 429)"))

    expect(() => purgeEdgeCache(logger, "footer saved")).not.toThrow()
    await flushEdgeCachePurge()

    expect(logger.warn).toHaveBeenCalledWith(
      "Cloudflare purge for pr-42.pragmaticpapers.com failed (footer saved): Cloudflare purge failed (HTTP 429)",
    )
  })
})
