import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  createHeadingNode,
  createParagraph,
  richText,
  SENTENCES,
} from "@/stories/fixtures/richText"
import {
  createTableCellNode,
  createTableHeaderNode,
  createTableNode,
  createTableRowNode,
} from "@/utilities/lexical"

import {
  stampTableOfContentsAnchors,
  TableOfContents,
  TableOfContentsButton,
  TableOfContentsProvider,
} from "."

function block(fields: Record<string, unknown>) {
  return { type: "block", fields, format: "", version: 2 }
}

const text = (i: number) => createParagraph(SENTENCES[i % SENTENCES.length]!)

// Built like an article's content, and stamped the way the save hook stamps it,
// so the entries come from the same resolvers the site uses. It opens with a
// paragraph (an Intro entry), nests h2–h4, repeats a heading (deduped anchor),
// puts a table right under a heading (folded into it) and another after a
// paragraph (listed on its own), and nests each iconed block under a heading.
const content = stampTableOfContentsAnchors(
  richText(
    text(0),
    createHeadingNode("Why the small races matter", "h2"),
    text(1),
    createHeadingNode("Turnout", "h3"),
    text(2),
    block({ blockType: "timeline", title: "The 2024 primary calendar" }),
    createHeadingNode("Off-year elections", "h4"),
    text(3),
    createHeadingNode("Where the money goes", "h2"),
    createTableNode([
      createTableRowNode([createTableHeaderNode("Body"), createTableHeaderNode("Budget")]),
      createTableRowNode([createTableCellNode("School board"), createTableCellNode("$1.2B")]),
    ]),
    block({ blockType: "interactiveMap", widgetTitle: "Council districts by margin" }),
    block({ blockType: "mediaCollage", layout: "grid", images: [{ image: 1 }] }),
    block({ blockType: "mediaCollage", layout: "carousel", images: [{ image: 1 }] }),
    block({ blockType: "socialEmbed", platform: "youtube" }),
    createHeadingNode("Turnout", "h3"),
    text(0),
    createHeadingNode("What to watch", "h2"),
    text(1),
    createTableNode([
      createTableRowNode([createTableHeaderNode("Race"), createTableHeaderNode("Seats")]),
      createTableRowNode([createTableCellNode("City council"), createTableCellNode("9")]),
    ]),
  ) as DefaultTypedEditorState,
)

const meta = {
  title: "Components/TableOfContents",
  component: TableOfContents,
  args: { content },
  // The icons hang left of their labels, so the list needs a gutter.
  render: (args) => (
    <TableOfContentsProvider>
      <div className="max-w-xs px-8 py-4">
        <TableOfContentsButton content={args.content} className="mb-4" />
        <TableOfContents {...args} />
      </div>
    </TableOfContentsProvider>
  ),
} satisfies Meta<typeof TableOfContents>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Table of contents" })
    const toc = within(nav)

    await expect(toc.getByRole("link", { name: "Intro" })).toHaveAttribute("href", "#intro")
    await expect(toc.getByRole("link", { name: "Off-year elections" })).toHaveAttribute(
      "href",
      "#off-year-elections",
    )
    // The repeated heading gets a deduplicated anchor.
    const turnout = toc.getAllByRole("link", { name: "Turnout" })
    await expect(turnout.map((link) => link.getAttribute("href"))).toEqual([
      "#turnout",
      "#turnout-2",
    ])

    // A table right under a heading folds into the heading's entry, which
    // takes the table icon; a table after a paragraph gets its own entry.
    const moneyIcon = toc
      .getByRole("link", { name: "Where the money goes" })
      .querySelector('[data-slot="toc-icon"]')
    await expect(moneyIcon).toHaveClass("mr-0.5")
    await expect(toc.getAllByRole("link", { name: "Table" })).toHaveLength(1)

    // Blocks resolve to labelled entries with their icons, nested under a heading.
    for (const label of [
      "The 2024 primary calendar",
      "Table",
      "Council districts by margin",
      "Image grid",
      "Carousel",
      "YouTube embed",
    ]) {
      const link = toc.getByRole("link", { name: label })
      await expect(link.querySelector('[data-slot="toc-icon"]')).toHaveClass("mr-1")
    }
    const nested = toc.getByRole("link", { name: "Image grid" }).closest('[data-slot="toc-list"]')
    await expect(nested).toHaveClass("pl-4")
  },
}

export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole("navigation", { name: "Table of contents" })

    await userEvent.click(canvas.getByRole("button", { name: "Collapse table of contents" }))
    await expect(nav).not.toBeVisible()
    const expand = canvas.getByRole("button", { name: "Expand table of contents" })
    await expect(expand).toHaveAttribute("aria-expanded", "false")
    await expect(expand).toHaveAttribute("aria-controls", nav.id)
  },
}

export const WithoutHeadings: Story = {
  args: { content: richText(text(0), text(1)) as DefaultTypedEditorState },
  play: async ({ canvasElement }) => {
    // An article with nothing to list renders neither the list nor its button.
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("navigation")).not.toBeInTheDocument()
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument()
  },
}
