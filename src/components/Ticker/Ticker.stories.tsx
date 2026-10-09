import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { liveBroadcast, tickerPosts, upcomingBroadcast } from "@/stories/fixtures/ticker"
import { shortURL } from "./LinkIcon"
import { TickerView } from "./TickerView"

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

    const pause = within(ticker).getByRole("checkbox", { name: "Pause ticker" })
    await userEvent.click(pause)
    await expect(pause).toBeChecked()
    await expect(getComputedStyle(track).animationPlayState).toBe("paused")

    // Leave it scrolling for whoever opens the story.
    await userEvent.click(pause)
    await expect(pause).not.toBeChecked()
    await expect(getComputedStyle(track).animationPlayState).toBe("running")
  },
}

/** A broadcast scheduled for later today. */
export const Upcoming: Story = {
  args: { broadcast: upcomingBroadcast, posts: tickerPosts },
}

/** Nothing on air: only the posts. */
export const PostsOnly: Story = {
  args: { broadcast: null, posts: tickerPosts },
}

/** On air with no posts to show: the broadcast takes the whole strip. */
export const LiveOnly: Story = {
  args: { broadcast: liveBroadcast, posts: [] },
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
