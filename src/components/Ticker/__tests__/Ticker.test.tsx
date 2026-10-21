import { render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
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
const { TICKER_EMPTY } = await import("../TickerView")

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

  it("sends the label in the server's HTML, before any feed is fetched", () => {
    const html = renderToString(<TickerLoader />)
    document.body.innerHTML = html
    const placeholder = document.querySelector<HTMLElement>("[data-ticker-placeholder]")
    expect(placeholder).toHaveTextContent("Latest")
    expect(placeholder).toHaveAttribute("aria-hidden", "true")
    expect(fetchFeed).not.toHaveBeenCalled()
    document.body.innerHTML = ""
  })

  it("keeps the strip when there's nothing to show, so the page below doesn't move", async () => {
    fetchFeed.mockResolvedValue(Response.json({ broadcast: null, posts: [] }))
    const { container } = render(<TickerLoader />)
    expect(await screen.findByText(TICKER_EMPTY)).toBeInTheDocument()
    expect(container.querySelector("[data-ticker-placeholder]")).not.toBeInTheDocument()
  })

  it("keeps the strip when the feed fails, so the page below doesn't move", async () => {
    fetchFeed.mockResolvedValue(new Response("", { status: 500 }))
    const { container } = render(<TickerLoader />)
    expect(await screen.findByText(TICKER_EMPTY)).toBeInTheDocument()
    expect(container.querySelector("[data-ticker-placeholder]")).not.toBeInTheDocument()
  })

  it("keeps the strip when the request fails, so the page below doesn't move", async () => {
    fetchFeed.mockRejectedValue(new TypeError("Failed to fetch"))
    const { container } = render(<TickerLoader />)
    expect(await screen.findByText(TICKER_EMPTY)).toBeInTheDocument()
    expect(container.querySelector("[data-ticker-placeholder]")).not.toBeInTheDocument()
  })
})
