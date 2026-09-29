import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import {
  feedArticle,
  feedBody,
  formBlockNode,
  headingNode,
  mediaBlockNode,
  phoneFrame,
  turnoutTable,
} from "@/stories/fixtures/feed"
import { createHeadingNode, createParagraph, richText } from "@/stories/fixtures/richText"

import { ArticleBlockPage, ArticleContentPage } from "./ArticlePage"
import { chunkArticle } from "./chunker"
import { FEED_TOP_INSET } from "./constants"
import type { ArticlePageItem, BlockPageKind, LexicalNode } from "./types"

const article = feedArticle()
const [, firstProse] = chunkArticle(article)

function blockPage(node: LexicalNode, blockType: string, heading?: LexicalNode): BlockPageKind {
  return { kind: "block", node, blockType, headingNode: heading }
}

/** The pages the server renders under the hero: one prose chunk or one full-bleed block each. */
const meta = {
  title: "Feed/ArticlePage",
  component: ArticleContentPage,
  globals: { theme: "dark" },
  parameters: { layout: "centered" },
  decorators: [phoneFrame],
  args: {
    article,
    page: firstProse as ArticlePageItem,
    topInset: FEED_TOP_INSET,
    isLast: false,
  },
} satisfies Meta<typeof ArticleContentPage>

export default meta
type Story = StoryObj<typeof meta>

/** A prose chunk opens with the heading the chunker carried onto it. */
export const Prose: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { name: "Why the small races matter" }),
    ).toBeVisible()
    await expect(canvas.getByText("Most of them are decided by a handful of votes.")).toBeVisible()
  },
}

/** The article's last page ends on the squiggle. */
export const LastPage: Story = {
  args: {
    page: { kind: "content", nodes: feedBody.slice(-2, -1), wordCount: 60 },
    isLast: true,
  },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("paragraph")).toBeVisible()
    await expect(canvasElement.querySelector("[class*='squiggle']")).toBeInTheDocument()
  },
}

/** Media fills the page, scaled to the viewport, as the lightbox shows it. */
export const Media: Story = {
  render: (args) => <ArticleBlockPage {...args} page={blockPage(mediaBlockNode, "mediaBlock")} />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("img")).toBeVisible()
  },
}

/** A table reflows into one card per row, labelled from the header row. */
export const Table: Story = {
  render: (args) => (
    <ArticleBlockPage {...args} page={blockPage(turnoutTable, "table", headingNode)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent("Turnout by county")
    await expect(canvas.getAllByRole("article")).toHaveLength(2)
    await expect(canvas.getByRole("heading", { level: 3, name: "Adams" })).toBeVisible()
    await expect(canvas.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "2022",
      "2024",
      "2022",
      "2024",
    ])
  },
}

/** A form waits behind a button, and opens in a dialog over the feed. */
export const Form: Story = {
  render: (args) => <ArticleBlockPage {...args} page={blockPage(formBlockNode, "formBlock")} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Pitch the editors")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Open form" }))
    const dialog = await screen.findByRole("dialog", { name: "Pitch the editors" })
    // The dialog fades in from opacity 0, so wait for it to finish rather than read it mid-fade.
    await waitFor(() =>
      expect(within(dialog).getByRole("textbox", { name: /Your pitch/ })).toBeVisible(),
    )
  },
}

/** A block with no feed renderer of its own falls back to the article's RichText converters. */
export const FallbackBlock: Story = {
  render: (args) => (
    <ArticleBlockPage
      {...args}
      page={blockPage(
        {
          type: "block",
          version: 2,
          fields: {
            blockType: "cta",
            richText: richText(
              createHeadingNode("Get every volume in your inbox", "h3"),
              createParagraph("One email a week. No ads, no tracking, unsubscribe any time."),
            ),
            links: [{ link: { type: "custom", url: "/newsletter", label: "Subscribe" } }],
          },
        },
        "cta",
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("link", { name: "Subscribe" }),
    ).toHaveAttribute("href", "/newsletter")
  },
}
