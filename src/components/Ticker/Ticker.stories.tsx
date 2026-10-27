import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import {
  fewTickerPosts,
  liveBroadcast,
  tickerPosts,
  upcomingBroadcast,
} from "@/stories/fixtures/ticker"
import { shortURL } from "./LinkIcon"
import { TickerPlaceholder } from "./TickerLoader"
import { TICKER_EMPTY, TickerView } from "./TickerView"

const meta = {
  title: "Components/Ticker",
  component: TickerView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TickerView>

export default meta
type Story = StoryObj<typeof meta>

/** A channel is on air: its broadcast is pinned at the start, and the posts scroll past beside it. */
export const Live: Story = {
  args: { broadcast: liveBroadcast, posts: tickerPosts },
  play: async ({ canvasElement }) => {
    const ticker = within(canvasElement).getByRole("region", { name: "Live and latest" })
    await expect(within(ticker).getAllByRole("link")[0]).toHaveAttribute("href", liveBroadcast.url)

    const track = canvasElement.querySelector(".ticker-track")!
    await expect(getComputedStyle(track).animationPlayState).toBe("running")

    // Scrolling, it sticks under the header on wider screens; paused, it lets go.
    const wide = matchMedia("(min-width: 48rem)").matches
    await expect(getComputedStyle(ticker).position).toBe(wide ? "sticky" : "static")

    const pause = within(ticker).getByRole("checkbox", { name: "Pause ticker" })
    await userEvent.click(pause)
    await expect(pause).toBeChecked()
    await expect(getComputedStyle(track).animationPlayState).toBe("paused")
    await expect(getComputedStyle(ticker).position).toBe("static")

    // Leave it scrolling for whoever opens the story.
    await userEvent.click(pause)
    await expect(pause).not.toBeChecked()
    await expect(getComputedStyle(track).animationPlayState).toBe("running")
  },
}

/** A broadcast scheduled for later today. */
export const Upcoming: Story = {
  args: {
    broadcast: upcomingBroadcast,
    posts: tickerPosts,
    now: new Date("2026-10-07T16:00:00Z"),
  },
}

/** A broadcast scheduled for a later day: its weekday comes before the time. */
export const UpcomingLaterInTheWeek: Story = {
  args: {
    broadcast: upcomingBroadcast,
    posts: tickerPosts,
    now: new Date("2026-10-05T16:00:00Z"),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Wednesday 7:00 p.m. ET")).toBeInTheDocument()
  },
}

/** Nothing on air: only the posts. */
export const PostsOnly: Story = {
  args: { broadcast: null, posts: tickerPosts },
}

/**
 * One short post: it goes round several times a pass, so the strip is full rather than one post
 * crossing an empty band.
 */
export const FewPosts: Story = {
  args: { broadcast: null, posts: fewTickerPosts },
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(".ticker-viewport")!
    const pass = canvasElement.querySelector<HTMLElement>(".ticker-track > ul")!
    await expect(pass.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      viewport.getBoundingClientRect().width,
    )
    // Still only one post for assistive tech.
    const list = within(canvasElement).getByRole("list", { name: "Latest posts" })
    await expect(within(list).getAllByRole("listitem")).toHaveLength(1)
  },
}

/** On air with no posts to show: the broadcast takes the whole strip. */
export const LiveOnly: Story = {
  args: { broadcast: liveBroadcast, posts: [] },
  play: async ({ canvasElement }) => {
    // Live, it sticks under the header on every screen, until the reader pauses it.
    const ticker = within(canvasElement).getByRole("region", { name: "Live and latest" })
    await expect(getComputedStyle(ticker).position).toBe("sticky")
    const pause = within(ticker).getByRole("checkbox", { name: "Pause ticker" })
    await userEvent.click(pause)
    await expect(getComputedStyle(ticker).position).toBe("static")
    await userEvent.click(pause)
  },
}

const filibuster = "https://pragmaticpapers.com/articles/filibuster"

/**
 * Pointing at a link's icon shows its full URL. The tooltip loads on that first point, so the
 * ticker ships no JavaScript until then.
 */
export const LinkTooltip: Story = {
  args: { broadcast: null, posts: tickerPosts },
  play: async ({ canvasElement }) => {
    const ticker = within(canvasElement).getByRole("region", { name: "Live and latest" })
    const name = `Link: ${shortURL(filibuster)}`
    await userEvent.hover(within(ticker).getByRole("link", { name }))
    // It fades in, so it's visible once the animation is under way.
    await waitFor(() => expect(screen.getByText(filibuster)).toBeVisible())

    // It closes when the pointer leaves, and the icon still opens the link.
    const link = within(ticker).getByRole("link", { name })
    await userEvent.unhover(link)
    await waitFor(() => expect(screen.queryByText(filibuster)).not.toBeInTheDocument())
    await expect(link).toHaveAttribute("href", filibuster)
    await expect(link).toHaveAttribute("target", "_blank")
  },
}

/**
 * What a page shows while the ticker's feed loads: the "Latest" label, sent with the page, in a
 * strip exactly the ticker's size, so nothing below moves and the label stays put when the
 * posts fade in.
 */
export const Loading: Story = {
  args: { broadcast: null, posts: tickerPosts },
  render: (args) => (
    <div className="flex flex-col">
      <TickerPlaceholder />
      <TickerView {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const placeholder = canvasElement.querySelector<HTMLElement>("[data-ticker-placeholder]")!
    const ticker = within(canvasElement).getByRole("region", { name: "Live and latest" })
    const box = (el: HTMLElement) => {
      const style = getComputedStyle(el)
      return [el.getBoundingClientRect().height, style.marginTop, style.marginBottom]
    }
    await expect(box(placeholder)).toEqual(box(ticker))

    // The label is where the ticker's own is, so it doesn't jump when the posts arrive.
    const label = (el: HTMLElement) => {
      const span = within(el).getByText("Latest")
      const rect = span.getBoundingClientRect()
      return [rect.left, rect.width, rect.height, getComputedStyle(span).color]
    }
    await expect(within(placeholder).getByText("Latest")).toBeVisible()
    await expect(label(placeholder)).toEqual(label(ticker))

    // The posts fade in on opacity alone, which the compositor can run without repainting.
    const posts = ticker.querySelector<HTMLElement>(".ticker-posts")!
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    await expect(getComputedStyle(posts).animationName).toBe(reduced ? "none" : "ticker-fade-in")
  },
}

/**
 * No channel on air and no posts: the strip stays, at the placeholder's size, and says so. Taking
 * it away once the feed arrived would shift everything below it.
 */
export const Empty: Story = {
  args: { broadcast: null, posts: [] },
  render: (args) => (
    <div className="flex flex-col">
      <TickerPlaceholder />
      <TickerView {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const placeholder = canvasElement.querySelector<HTMLElement>("[data-ticker-placeholder]")!
    const ticker = within(canvasElement).getByRole("region", { name: "Live and latest" })
    const box = (el: HTMLElement) => {
      const style = getComputedStyle(el)
      return [el.getBoundingClientRect().height, style.marginTop, style.marginBottom]
    }
    await expect(box(placeholder)).toEqual(box(ticker))
    // It fades in, as posts would.
    await waitFor(() => expect(within(ticker).getByText(TICKER_EMPTY)).toBeVisible())
    await expect(within(ticker).queryByRole("checkbox")).not.toBeInTheDocument()
  },
}
