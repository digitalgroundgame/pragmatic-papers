import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { liveBroadcast, tickerPosts, upcomingBroadcast } from "@/stories/fixtures/ticker"
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

  it("names each post's source and opens it in a new tab", () => {
    render(<TickerView broadcast={null} posts={tickerPosts} />)
    const first = screen.getByRole("link", { name: /^On Bluesky:\s*New in Volume 12/ })
    expect(first).toHaveAttribute("href", tickerPosts[0]!.url)
    expect(first).toHaveAttribute("target", "_blank")
    expect(first).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(screen.getByRole("link", { name: /^On X:\s*The filibuster/ })).toBeInTheDocument()
  })

  it("shows each link in a post as an icon, with the full URL on hover", () => {
    render(<TickerView broadcast={null} posts={tickerPosts} />)
    const post = screen.getByRole("link", { name: /^On X:\s*The filibuster/ })
    expect(post).not.toHaveTextContent("t.co")
    expect(post).toHaveTextContent(/cloture vote\.$/)

    const link = screen.getByRole("link", { name: "Link: pragmaticpapers.com/articles/filibuster" })
    expect(link).toHaveAttribute("href", "https://pragmaticpapers.com/articles/filibuster")
    expect(link).toHaveAttribute("title", "https://pragmaticpapers.com/articles/filibuster")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("shows an upcoming broadcast with its start time in the paper's zone", () => {
    render(<TickerView broadcast={upcomingBroadcast} posts={[]} />)
    const link = screen.getByRole("link")
    expect(link).toHaveTextContent("Upcoming")
    expect(within(link).getByText("7:00 p.m. ET")).toHaveAttribute(
      "dateTime",
      upcomingBroadcast.startsAt,
    )
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })
})
