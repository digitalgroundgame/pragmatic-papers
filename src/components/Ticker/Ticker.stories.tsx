import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { liveBroadcast, tickerPosts, upcomingBroadcast } from "@/stories/fixtures/ticker"
import { TickerView } from "./TickerView"

const meta = {
  title: "Components/Ticker",
  component: TickerView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TickerView>

export default meta
type Story = StoryObj<typeof meta>

/** The podcast is on air: it's pinned at the start, and the posts scroll past beside it. */
export const Live: Story = {
  args: { broadcast: liveBroadcast, posts: tickerPosts },
  play: async ({ canvasElement }) => {
    const ticker = within(canvasElement).getByRole("region", { name: "Live and latest" })
    await expect(within(ticker).getAllByRole("link")[0]).toHaveAttribute("href", liveBroadcast.url)

    const pause = within(ticker).getByRole("checkbox", { name: "Pause ticker" })
    await userEvent.click(pause)
    await expect(pause).toBeChecked()
    const track = canvasElement.querySelector(".ticker-track")!
    await expect(getComputedStyle(track).animationPlayState).toBe("paused")
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
