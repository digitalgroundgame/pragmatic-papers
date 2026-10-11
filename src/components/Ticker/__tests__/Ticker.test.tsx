import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { liveBroadcast, tickerPosts } from "@/stories/fixtures/ticker"

const { header, getTickerFeed } = vi.hoisted(() => ({
  header: { ticker: false },
  getTickerFeed: vi.fn(),
}))

vi.mock("@/data/globals", () => ({
  getGlobal: async (slug: string) =>
    slug === "header" ? { ticker: { enabled: header.ticker } } : {},
}))
vi.mock("../getTickerFeed", () => ({ getTickerFeed }))

const { Ticker } = await import("..")

beforeEach(() => {
  header.ticker = false
  getTickerFeed.mockReset().mockResolvedValue({ broadcast: liveBroadcast, posts: tickerPosts })
})

describe("Ticker", () => {
  it("renders nothing, and asks no source, while it's switched off in the Header", async () => {
    expect(await Ticker()).toBeNull()
    expect(getTickerFeed).not.toHaveBeenCalled()
  })

  it("shows the feed while it's switched on", async () => {
    header.ticker = true
    render(<>{await Ticker()}</>)
    expect(screen.getByRole("region", { name: "Live and latest" })).toBeInTheDocument()
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", liveBroadcast.url)
  })
})
