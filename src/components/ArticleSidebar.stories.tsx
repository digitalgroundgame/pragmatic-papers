import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import {
  createHeadingNode,
  createParagraph,
  richText,
  SENTENCES,
} from "@/stories/fixtures/richText"

import { ArticleSidebar } from "./ArticleSidebar"
import {
  stampTableOfContentsAnchors,
  TableOfContents,
  TableOfContentsProvider,
} from "./TableOfContents"

// More entries than fit beside the text on a laptop screen
const longContent = stampTableOfContentsAnchors(
  richText(
    ...Array.from({ length: 40 }, (_, i) => [
      createHeadingNode(`Section ${i + 1}`, i % 3 ? "h3" : "h2"),
      createParagraph(SENTENCES[i % SENTENCES.length]!),
    ]).flat(),
  ) as DefaultTypedEditorState,
)

const meta = {
  title: "Components/ArticleSidebar",
  component: ArticleSidebar,
  render: () => (
    <TableOfContentsProvider>
      <div className="container flex flex-col gap-3 lg:flex-row lg:gap-6">
        <ArticleSidebar>
          <TableOfContents content={longContent} />
        </ArticleSidebar>
        <div className="mx-auto h-[300vh] max-w-2xl">The article&apos;s text</div>
      </div>
    </TableOfContentsProvider>
  ),
} satisfies Meta<typeof ArticleSidebar>

export default meta
type Story = StoryObj<typeof meta>

export const LongTableOfContents: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scroller = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar-scroll"]')!

    // Capped to the room below the header, so it scrolls rather than running off the screen.
    await expect(scroller.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)

    const last = canvas.getByRole("link", { name: "Section 40" })
    scroller.scrollTop = scroller.scrollHeight
    const box = scroller.getBoundingClientRect()
    await expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom)

    // The icons that hang left of the entries stay inside the scrolling box.
    const icon = canvas
      .getByRole("link", { name: "Section 1" })
      .querySelector('[data-slot="toc-icon"]')!
    await expect(icon.getBoundingClientRect().left).toBeGreaterThanOrEqual(box.left)
  },
}

export const ShortTableOfContents: Story = {
  render: () => (
    <TableOfContentsProvider>
      <ArticleSidebar>
        <TableOfContents
          content={stampTableOfContentsAnchors(
            richText(createHeadingNode("Only section", "h2")) as DefaultTypedEditorState,
          )}
        />
      </ArticleSidebar>
    </TableOfContentsProvider>
  ),
  play: async ({ canvasElement }) => {
    // Nothing to scroll: the box is as tall as its contents.
    const scroller = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar-scroll"]')!
    await expect(scroller.scrollHeight).toBe(scroller.clientHeight)
  },
}
