import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as Integrations from "@/integrations"

const { mockPurge, mockRevalidateAll, mockWarmWorkerSoon } = vi.hoisted(() => ({
  mockPurge: vi.fn(),
  mockRevalidateAll: vi.fn(),
  mockWarmWorkerSoon: vi.fn(),
}))

vi.mock("../warmWorker", () => ({ warmWorkerSoon: mockWarmWorkerSoon }))

vi.mock("@/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof Integrations>()
  return {
    ...actual,
    cloudflareCache: { ...actual.cloudflareCache, purge: mockPurge },
    cloudflareWorkerCache: { ...actual.cloudflareWorkerCache, revalidateAll: mockRevalidateAll },
  }
})

const { purgeEdgeCache, flushEdgeCachePurge } = await import("../purgeEdgeCache")

const logger = { info: vi.fn(), warn: vi.fn() }

function configure(): void {
  vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone123")
  vi.stubEnv("CLOUDFLARE_PURGE_TOKEN", "token")
  vi.stubEnv("SERVER_URL", "https://pr-42.pragmaticpapers.com")
}

function configureWorker(): void {
  vi.stubEnv("WORKER_URL", "https://pragmatic-papers-staging.example.workers.dev")
  vi.stubEnv("PAYLOAD_SECRET", "secret")
}

beforeEach(() => {
  vi.stubEnv("WORKER_URL", "")
  mockPurge.mockReset().mockResolvedValue(undefined)
  mockRevalidateAll.mockReset().mockResolvedValue(undefined)
  mockWarmWorkerSoon.mockReset()
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

  describe("with a Worker in front", () => {
    it("clears the Worker's cache even when the edge can't be purged", async () => {
      configureWorker()
      vi.stubEnv("SERVER_URL", "http://localhost:8000")

      purgeEdgeCache(logger, "article published")
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).toHaveBeenCalledTimes(1)
      expect(mockPurge).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        "Cleared every page from the Worker's cache at https://pragmatic-papers-staging.example.workers.dev (article published)",
      )
    })

    it("clears the Worker before purging the edge, once for a burst", async () => {
      configure()
      configureWorker()
      const order: string[] = []
      mockRevalidateAll.mockImplementation(async () => void order.push("worker"))
      mockPurge.mockImplementation(async () => void order.push("edge"))

      purgeEdgeCache(logger, "article published")
      purgeEdgeCache(logger, "volume published")
      await flushEdgeCachePurge()

      expect(order).toEqual(["worker", "edge"])
    })

    it("purges only what a burst's saves named from the Worker", async () => {
      configureWorker()

      purgeEdgeCache(logger, "page about", { paths: ["/about", "/sitemap.xml"] })
      purgeEdgeCache(logger, "article a", { paths: ["/articles/a", null], shared: true })
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).toHaveBeenCalledExactlyOnceWith({
        paths: ["/about", "/sitemap.xml", "/articles/a"],
        shared: true,
      })
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/^Cleared \/about, \/sitemap.xml, \/articles\/a, the shared pages /),
      )
    })

    it("tells the Worker what a burst's saves revalidated, to revalidate only that", async () => {
      configureWorker()

      purgeEdgeCache(logger, "page about", {
        paths: ["/about", "/sitemap.xml"],
        revalidated: { paths: ["/about"], tags: ["pages-sitemap"] },
      })
      purgeEdgeCache(logger, "doc a", {
        paths: ["/docs"],
        revalidated: { paths: ["/docs", "/about"], tags: ["docs"] },
      })
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).toHaveBeenCalledExactlyOnceWith({
        paths: ["/about", "/sitemap.xml", "/docs"],
        shared: false,
        revalidated: { paths: ["/about", "/docs"], tags: ["pages-sitemap", "docs"] },
      })
    })

    it("revalidates every page in the Worker's Next cache once a save didn't say", async () => {
      configureWorker()

      purgeEdgeCache(logger, "page about", {
        paths: ["/about"],
        revalidated: { paths: ["/about"], tags: [] },
      })
      purgeEdgeCache(logger, "article a", { paths: ["/articles/a"] })
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).toHaveBeenCalledExactlyOnceWith({
        paths: ["/about", "/articles/a"],
        shared: false,
        revalidated: undefined,
      })
    })

    it("purges every page once any save in the burst named none", async () => {
      configureWorker()

      purgeEdgeCache(logger, "page about", { paths: ["/about"] })
      purgeEdgeCache(logger, "header saved")
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).toHaveBeenCalledExactlyOnceWith({})
    })

    it("warms the Worker's pages once its cache is cleared", async () => {
      configureWorker()

      purgeEdgeCache(logger, "article published")
      await flushEdgeCachePurge()

      expect(mockWarmWorkerSoon).toHaveBeenCalledExactlyOnceWith(logger)
    })

    it("leaves the Worker alone when asked, still purging the edge", async () => {
      configure()
      configureWorker()

      purgeEdgeCache(logger, "deploy", { worker: false })
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).not.toHaveBeenCalled()
      expect(mockWarmWorkerSoon).not.toHaveBeenCalled()
      expect(mockPurge).toHaveBeenCalledTimes(1)
    })

    it("skips when asked to leave the Worker alone and the edge can't be purged", async () => {
      configureWorker()
      vi.stubEnv("SERVER_URL", "http://localhost:8000")

      purgeEdgeCache(logger, "deploy", { worker: false })
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Skipping Cloudflare purge"))
    })

    it("clears the Worker when any purge in a burst asks for it", async () => {
      configure()
      configureWorker()

      purgeEdgeCache(logger, "deploy", { worker: false })
      purgeEdgeCache(logger, "article published")
      await flushEdgeCachePurge()

      expect(mockRevalidateAll).toHaveBeenCalledTimes(1)
    })

    it("still purges the edge when the Worker fails, and warns", async () => {
      configure()
      configureWorker()
      mockRevalidateAll.mockRejectedValue(new Error("Worker revalidation failed (HTTP 401)"))

      purgeEdgeCache(logger, "footer saved")
      await flushEdgeCachePurge()

      expect(mockPurge).toHaveBeenCalledTimes(1)
      expect(mockWarmWorkerSoon).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        "Clearing the Worker's cache at https://pragmatic-papers-staging.example.workers.dev failed (footer saved): Worker revalidation failed (HTTP 401)",
      )
    })
  })
})
