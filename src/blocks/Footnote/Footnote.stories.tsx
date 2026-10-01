import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { knownContrastIssue } from "@/stories/a11y"
import { FeedHTML } from "@/stories/FeedHTML"
import { footnoteBlock, footnotes } from "@/stories/fixtures/blocks"
import { storyFeedContext } from "@/stories/fixtures/feedContext"

import { FootnoteBlock } from "./Component"
import { footnotesToHTML, footnoteToHTML } from "./converters"

const meta = {
  title: "Blocks/Footnote",
  component: FootnoteBlock,
  parameters: knownContrastIssue,
  args: footnoteBlock,
  render: (args) => (
    <>
      <p className="max-w-prose font-serif text-lg">
        Only 11 percent of registered voters cast a ballot
        <FootnoteBlock {...args} /> in the special election.
      </p>
      <ol className="mt-8 text-sm">
        <li id={`footnote-${args.index}`} value={args.index ?? undefined}>
          {args.note}
        </li>
      </ol>
    </>
  ),
} satisfies Meta<typeof FootnoteBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const link = within(canvasElement).getByRole("link", { name: `[${args.index}]` })
    await expect(link).toHaveAttribute("href", `#footnote-${args.index}`)
    await expect(link).toHaveAccessibleDescription(args.note!)
  },
}

/**
 * Footnotes in the feeds: a plain `[n]` marker, and the article's notes listed
 * in order after its content. No anchors, which feed readers and Substack drop.
 */
export const Feed: Story = {
  render: (args) => (
    <FeedHTML
      html={[
        `<p>Only 11 percent of registered voters cast a ballot${footnoteToHTML(args)} in the special election.</p>`,
        footnotesToHTML(footnotes, storyFeedContext()),
      ].join("")}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("[3]")).toBeInTheDocument()
    await expect(canvas.getByRole("heading", { name: "Notes" })).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "County Clerk" })).toHaveAttribute(
      "href",
      "https://example.com/certified-results",
    )
  },
}
