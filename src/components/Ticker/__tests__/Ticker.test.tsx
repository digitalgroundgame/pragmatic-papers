import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
const { TickerLoader, TICKER_FEED_PATH } = await import("../TickerLoader")

const fetchFeed = vi.fn()

beforeEach(() => {
  header.ticker = false
  fetchFeed
    .mockReset()
    .mockResolvedValue(Response.json({ broadcast: liveBroadcast, posts: tickerPosts }))
  vi.stubGlobal("fetch", fetchFeed)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Ticker", () => {
  it("renders nothing while it's switched off in the Header", async () => {
    expect(await Ticker()).toBeNull()
  })

  it("leaves its feed to the browser while it's switched on, so no source is read as the page renders", async () => {
    header.ticker = true
    const ticker = (await Ticker()) as React.ReactElement
    expect(ticker.type).toBe(TickerLoader)
    expect(getTickerFeed).not.toHaveBeenCalled()
  })
})

describe("TickerLoader", () => {
  it("holds the ticker's place until the feed arrives, then shows it", async () => {
    const { container } = render(<TickerLoader />)
    expect(container.querySelector("[data-ticker-placeholder]")).toBeInTheDocument()
    expect(fetchFeed).toHaveBeenCalledWith(TICKER_FEED_PATH, expect.anything())

    expect(await screen.findByRole("region", { name: "Live and latest" })).toBeInTheDocument()
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", liveBroadcast.url)
    expect(container.querySelector("[data-ticker-placeholder]")).not.toBeInTheDocument()
  })

  it("takes the strip away when there's nothing to show", async () => {
    fetchFeed.mockResolvedValue(Response.json({ broadcast: null, posts: [] }))
    const { container } = render(<TickerLoader />)
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it("takes the strip away when the feed fails", async () => {
    fetchFeed.mockResolvedValue(new Response("", { status: 500 }))
    const { container } = render(<TickerLoader />)
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it("takes the strip away when the request fails", async () => {
    fetchFeed.mockRejectedValue(new TypeError("Failed to fetch"))
    const { container } = render(<TickerLoader />)
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
