import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  fewTickerPosts,
  liveBroadcast,
  tickerPosts,
  upcomingBroadcast,
} from "@/stories/fixtures/ticker"
import { loopRounds } from "../items"
import { TICKER_PAUSED_KEY } from "../pause"
import { TickerView } from "../TickerView"

describe("TickerView", () => {
  it("renders nothing when there is nothing to show", () => {
    const { container } = render(<TickerView broadcast={null} posts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("links the live broadcast first, then each post once for assistive tech", () => {
    render(<TickerView broadcast={liveBroadcast} posts={tickerPosts} />)
    const ticker = screen.getByRole("region", { name: "Live and latest" })

    const links = within(ticker).getAllByRole("link")
    expect(links[0]).toHaveAttribute("href", liveBroadcast.url)
    expect(links[0]).toHaveTextContent(`Live${liveBroadcast.title}`)
    // The scrolling copy is hidden, so each post and each of its links is announced once.
    const postLinks = tickerPosts.reduce((sum, post) => sum + post.links.length, 0)
    expect(links).toHaveLength(1 + tickerPosts.length + postLinks)
    expect(within(ticker).getByRole("list", { name: "Latest posts" })).toBeInTheDocument()
    expect(within(ticker).getByRole("checkbox", { name: "Pause ticker" })).not.toBeChecked()
  })

  it("repeats a few posts to fill the strip, announcing each one once", () => {
    const rounds = loopRounds(fewTickerPosts)
    expect(rounds).toBeGreaterThan(1)
    render(<TickerView broadcast={null} posts={fewTickerPosts} />)

    const list = screen.getByRole("list", { name: "Latest posts" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(fewTickerPosts.length)
    expect(within(list).getAllByRole("link")).toHaveLength(fewTickerPosts.length)

    const items = list.querySelectorAll("li")
    expect(items).toHaveLength(rounds * fewTickerPosts.length)
    for (const repeat of Array.from(items).slice(fewTickerPosts.length)) {
      expect(repeat).toHaveAttribute("aria-hidden", "true")
      expect(repeat).toHaveAttribute("inert")
      expect(repeat).toHaveClass("motion-reduce:hidden")
    }
  })

  it("names each post's source and opens it in a new tab", () => {
    render(<TickerView broadcast={null} posts={tickerPosts} />)
    const first = screen.getByRole("link", { name: /^On Bluesky:\s*New in Volume 12/ })
    expect(first).toHaveAttribute("href", tickerPosts[0]!.url)
    expect(first).toHaveAttribute("target", "_blank")
    expect(first).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(screen.getByRole("link", { name: /^On X:\s*The filibuster/ })).toBeInTheDocument()
  })

  it("shows each link in a post as an icon after its words", () => {
    render(<TickerView broadcast={null} posts={tickerPosts} />)
    const post = screen.getByRole("link", { name: /^On X:\s*The filibuster/ })
    expect(post).not.toHaveTextContent("t.co")
    expect(post).toHaveTextContent(/cloture vote\.$/)

    const link = screen.getByRole("link", { name: "Link: pragmaticpapers.com/articles/filibuster" })
    expect(link).toHaveAttribute("href", "https://pragmaticpapers.com/articles/filibuster")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("mounts paused for a reader who paused it on an earlier page", () => {
    localStorage.setItem(TICKER_PAUSED_KEY, "1")
    try {
      render(<TickerView broadcast={null} posts={tickerPosts} />)
      expect(screen.getByRole("checkbox", { name: "Pause ticker" })).toBeChecked()
    } finally {
      localStorage.clear()
    }
  })

  it("marks a live broadcast, and lets the reader pause it with no posts beside it", () => {
    render(<TickerView broadcast={liveBroadcast} posts={[]} />)
    const ticker = screen.getByRole("region", { name: "Live and latest" })
    expect(ticker).toHaveAttribute("data-live")
    expect(within(ticker).getByRole("checkbox", { name: "Pause ticker" })).toBeInTheDocument()
  })

  it("shows an upcoming broadcast with its start time in the paper's zone", () => {
    render(
      <TickerView
        broadcast={upcomingBroadcast}
        posts={[]}
        now={new Date("2026-10-07T16:00:00Z")}
      />,
    )
    const link = screen.getByRole("link")
    expect(link).toHaveTextContent("Upcoming")
    expect(within(link).getByText("7:00 p.m. ET")).toHaveAttribute(
      "dateTime",
      upcomingBroadcast.startsAt,
    )
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.getByRole("region")).not.toHaveAttribute("data-live")
  })

  it("puts the weekday before the start time when the broadcast isn't today", () => {
    render(
      <TickerView
        broadcast={upcomingBroadcast}
        posts={[]}
        now={new Date("2026-10-05T16:00:00Z")}
      />,
    )
    expect(screen.getByText("Wednesday 7:00 p.m. ET")).toHaveAttribute(
      "dateTime",
      upcomingBroadcast.startsAt,
    )
  })
})
