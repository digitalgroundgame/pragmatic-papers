import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, waitFor } from "storybook/test"

import { ArticleViewBeacon } from "."

const sendBeacon = fn((_url: string | URL) => true)

const meta = {
  title: "Components/ArticleViewBeacon",
  component: ArticleViewBeacon,
  args: { articleId: 7 },
  beforeEach: () => {
    const original = navigator.sendBeacon
    sendBeacon.mockClear()
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true })
    return () => {
      Object.defineProperty(navigator, "sendBeacon", { value: original, configurable: true })
    }
  },
} satisfies Meta<typeof ArticleViewBeacon>

export default meta
type Story = StoryObj<typeof meta>

/** Renders nothing, and counts the visit once with our own view count. */
export const CountsTheVisit: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(sendBeacon).toHaveBeenCalledWith("/api/articles/7/view"))
    await expect(sendBeacon).toHaveBeenCalledTimes(1)
    await expect(canvasElement).toBeEmptyDOMElement()
  },
}
