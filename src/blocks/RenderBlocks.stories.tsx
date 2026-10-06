import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import type { Page } from "@/payload-types"
import { knownContrastIssue } from "@/stories/a11y"
import {
  articleBody,
  createHeadingNode,
  createParagraph,
  richText,
} from "@/stories/fixtures/richText"

import { RenderBlocks } from "./RenderBlocks"

type Block = Page["layout"][number]

const content: Block = {
  id: "content",
  blockType: "content",
  width: "narrow",
  columns: [{ id: "c1", size: "full", richText: articleBody }],
}

const cta: Block = {
  id: "cta",
  blockType: "cta",
  richText: richText(
    createHeadingNode("Get every volume in your inbox", "h3"),
    createParagraph("One email a week."),
  ),
  links: [{ link: { type: "custom", url: "/newsletter", label: "Subscribe" } }],
}

const timeline: Block = {
  id: "timeline",
  blockType: "timeline",
  title: "How the district map changed",
  events: [
    {
      date: "2021-11-04T12:00:00.000Z",
      title: "Commission draws the first map",
      description: "The bipartisan commission deadlocks.",
    },
  ],
}

/** A form block whose form came back as a bare ID (depth too shallow): nothing to render. */
const unresolvedForm: Block = { id: "form", blockType: "formBlock", form: 7 }

/** A block type the renderer doesn't know, as an old or renamed block would arrive. */
const unknown = { id: "retired", blockType: "retiredBlock" } as unknown as Block

const meta = {
  title: "Blocks/RenderBlocks",
  component: RenderBlocks,
  parameters: { layout: "fullscreen", ...knownContrastIssue },
  args: { blocks: [content, unresolvedForm, cta, unknown, timeline] },
} satisfies Meta<typeof RenderBlocks>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Each block goes to its own component, in the order the editor laid them out; one it can't
 * render (an unresolved form, an unknown type) is skipped without taking the others with it.
 */
export const MixedLayout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const contentHeading = canvas.getByRole("heading", { name: "Why the small races matter" })
    const ctaHeading = canvas.getByRole("heading", { name: "Get every volume in your inbox" })
    const timelineHeading = canvas.getByRole("heading", { name: "How the district map changed" })

    await expect(canvas.getByRole("link", { name: "Subscribe" })).toHaveAttribute(
      "href",
      "/newsletter",
    )
    await expect(canvas.getByText("Commission draws the first map")).toBeInTheDocument()

    const follows = (a: Node, b: Node): boolean =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    await expect(follows(contentHeading, ctaHeading)).toBe(true)
    await expect(follows(ctaHeading, timelineHeading)).toBe(true)

    await expect(canvasElement.querySelector("form")).not.toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { blocks: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement()
  },
}
