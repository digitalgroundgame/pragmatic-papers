// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import { liveBroadcast, tickerPosts } from "@/stories/fixtures/ticker"

const { header, getTickerFeed } = vi.hoisted(() => ({
  header: { enabled: false },
  getTickerFeed: vi.fn(),
}))

vi.mock("@/data/globals", () => ({
  getGlobal: async (slug: string) => (slug === "header" ? { ticker: { ...header } } : {}),
}))
vi.mock("@/components/Ticker/getTickerFeed", () => ({ getTickerFeed }))

const { GET } = await import("../route")

beforeEach(() => {
  header.enabled = false
  getTickerFeed.mockReset().mockResolvedValue({ broadcast: liveBroadcast, posts: tickerPosts })
})

describe("/ticker.json", () => {
  it("serves the feed while the ticker is switched on", async () => {
    header.enabled = true
    const response = await GET()
    expect(await response.json()).toEqual({ broadcast: liveBroadcast, posts: tickerPosts })
  })

  it("serves an empty feed, and asks no source, while it's switched off", async () => {
    const response = await GET()
    expect(await response.json()).toEqual({ broadcast: null, posts: [] })
    expect(getTickerFeed).not.toHaveBeenCalled()
  })

  it("is kept a minute at the edge", async () => {
    header.enabled = true
    const response = await GET()
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=600",
    )
  })
})
