import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { tickerPosts } from "@/stories/fixtures/ticker"
import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { TickerPostsTable } from "./TickerPostsTable"

const meta = {
  title: "Admin/Ticker/TickerPostsTable",
  component: TickerPostsTable,
  decorators: [withPayloadAdminTheme],
  args: {
    lists: [
      tickerPosts.filter((post) => post.source === "bluesky"),
      tickerPosts.filter((post) => post.source === "x"),
    ],
    hidden: [],
    onToggle: fn(),
  },
} satisfies Meta<typeof TickerPostsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole("row", { name: /filibuster/ })
    await expect(row).toHaveTextContent("On the ticker")
    await userEvent.click(within(row).getByRole("button", { name: /^Hide/ }))
    await expect(args.onToggle).toHaveBeenCalledWith(tickerPosts[1], true)
  },
}

export const WithHiddenPost: Story = {
  args: { hidden: ["https://x.com/PragPapers/status/2"] },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole("row", { name: /filibuster/ })
    await expect(row).toHaveTextContent("Hidden")
    await expect(within(row).getByRole("button", { name: /^Show/ })).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { lists: [[], []] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/No posts right now/)).toBeInTheDocument()
  },
}
