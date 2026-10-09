import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { liveBroadcast, tickerPosts } from "@/stories/fixtures/ticker"

const { experiment, getTickerFeed } = vi.hoisted(() => ({
  experiment: { ticker: false },
  getTickerFeed: vi.fn(),
}))

vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async (name: string) => name === "ticker" && experiment.ticker,
}))
vi.mock("../getTickerFeed", () => ({ getTickerFeed }))

const { Ticker } = await import("..")

beforeEach(() => {
  experiment.ticker = false
  getTickerFeed.mockReset().mockResolvedValue({ broadcast: liveBroadcast, posts: tickerPosts })
})

describe("Ticker", () => {
  it("renders nothing, and asks no source, while the experiment is off", async () => {
    expect(await Ticker()).toBeNull()
    expect(getTickerFeed).not.toHaveBeenCalled()
  })

  it("shows the feed while the experiment is on", async () => {
    experiment.ticker = true
    render(<>{await Ticker()}</>)
    expect(screen.getByRole("region", { name: "Live and latest" })).toBeInTheDocument()
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", liveBroadcast.url)
  })
})
