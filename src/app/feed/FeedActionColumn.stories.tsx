import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, spyOn, userEvent, within } from "storybook/test"

import { authors } from "@/stories/fixtures/docs"
import { feedSummary } from "@/stories/fixtures/feed"

import { FeedActionColumn } from "./FeedActionColumn"

const meta = {
  title: "Feed/FeedActionColumn",
  component: FeedActionColumn,
  globals: { theme: "dark" },
  args: { article: feedSummary() },
  decorators: [
    (Story) => (
      <div className="flex w-[120px] justify-end bg-slate-800 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedActionColumn>

export default meta
type Story = StoryObj<typeof meta>

export const OneAuthor: Story = {}

/** Several authors stack with an overlap; one without a photo shows initials. */
export const SeveralAuthors: Story = {
  args: { article: feedSummary({ authors }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("link")).toHaveLength(3)
    await expect(canvas.getByText("SO")).toBeInTheDocument()
  },
}

/** Share uses the native sheet where there is one. */
export const ShareNative: Story = {
  beforeEach: () => {
    const original = navigator.share
    const share = fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", { value: share, configurable: true })
    return () => {
      Object.defineProperty(navigator, "share", { value: original, configurable: true })
    }
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Share article" }))
    await expect(navigator.share).toHaveBeenCalledWith({
      title: args.article.title,
      url: expect.stringMatching(new RegExp(`/articles/${args.article.slug}$`)),
    })
  },
}

/** Without a share sheet (most desktops), it copies the article's link. */
export const ShareCopiesLink: Story = {
  beforeEach: () => {
    const original = navigator.share
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true })
    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    return () => {
      writeText.mockRestore()
      Object.defineProperty(navigator, "share", { value: original, configurable: true })
    }
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Share article" }))
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/articles/${args.article.slug}$`)),
    )
  },
}
