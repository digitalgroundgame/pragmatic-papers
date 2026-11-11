import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { stampTableOfContentsAnchors } from "@/components/TableOfContents"
import { MathJaxProviderRoot } from "@/providers/MathJaxProvider"
import { landscapeImage, mediaFixture, portraitImage } from "@/stories/fixtures/media"
import {
  articleBody,
  createLinkNode,
  createHeadingNode,
  createParagraph,
  createTextNode,
  richText,
  SENTENCES,
  TextFormat,
} from "@/stories/fixtures/richText"
import { isolatedDocs } from "@/stories/isolatedDocs"

import RichText from "."

function block(fields: Record<string, unknown>) {
  return { type: "block", fields, format: "", version: 2 }
}

function inlineBlock(fields: Record<string, unknown>) {
  return { type: "inlineBlock", fields, version: 1 }
}

const meta = {
  title: "Components/RichText",
  component: RichText,
  parameters: { layout: "fullscreen" },
  args: { data: articleBody as DefaultTypedEditorState },
  decorators: [
    (Story) => (
      <div className="py-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RichText>

export default meta
type Story = StoryObj<typeof meta>

export const Prose: Story = {}

export const WithoutProse: Story = {
  args: { enableProse: false },
}

/** An article body mixing the blocks writers reach for most. */
export const ArticleWithBlocks: Story = {
  decorators: [
    (Story) => (
      <MathJaxProviderRoot>
        <Story />
      </MathJaxProviderRoot>
    ),
  ],
  args: {
    data: richText(
      createParagraph([
        createTextNode(`${SENTENCES[1]} `),
        inlineBlock({ blockType: "footnote", index: 1, note: "County clerk, certified results." }),
      ] as never),
      block({
        blockType: "banner",
        style: "warning",
        content: richText(createParagraph("Results are unofficial until certified.")),
      }),
      createParagraph([
        createTextNode("Turnout is "),
        inlineBlock({
          blockType: "inlineMathBlock",
          math: "\\frac{b}{r}",
          description: "ballots over registered voters",
        }),
        createTextNode(", and only ", TextFormat.Normal),
        createTextNode("one in ten", TextFormat.Italic),
        createTextNode(" showed up."),
      ] as never),
      block({ blockType: "mediaBlock", media: landscapeImage }),
      block({ blockType: "squiggleRule", variant: "static", size: "medium" }),
      block({
        blockType: "code",
        language: "typescript",
        code: "const turnout = ballots / registered // 0.098",
      }),
      createParagraph(SENTENCES[3]),
    ) as DefaultTypedEditorState,
  },
}

const captionedImage = mediaFixture({
  caption: richText(
    createParagraph([
      createTextNode("The ridge above town at dusk. Photo: "),
      createLinkNode("County Archive", "https://example.com/archive"),
    ]),
  ),
})

/**
 * Images as they sit in an article: a captioned and an uncaptioned media block
 * between paragraphs, each breaking out of the text column and opening a lightbox.
 */
export const ArticleWithImages: Story = {
  args: {
    data: richText(
      createParagraph(SENTENCES[0]),
      block({ blockType: "mediaBlock", media: captionedImage }),
      createParagraph(SENTENCES[1]),
      block({ blockType: "mediaBlock", media: portraitImage }),
      createParagraph(SENTENCES[2]),
    ) as DefaultTypedEditorState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [captionedTrigger, plainTrigger] = canvas.getAllByRole("button")

    // Each lightbox trigger holds only its image; the caption link stays a plain link.
    await expect(within(captionedTrigger!).getByRole("img")).toHaveAttribute(
      "alt",
      captionedImage.alt,
    )
    await expect(within(captionedTrigger!).queryByRole("link")).not.toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "County Archive" })).toBeInTheDocument()
    await expect(plainTrigger!.closest("figure")).toBeInTheDocument()
    await expect(plainTrigger!.closest("picture")).not.toBeInTheDocument()

    await userEvent.click(plainTrigger!)
    const dialog = await screen.findByRole("dialog")
    await expect(within(dialog).getByRole("img")).toHaveAttribute("alt", portraitImage.alt)
  },
}

/** Selected text is white on the brand fill, so a highlight reads as the site's orange. */
async function expectBrandSelection(canvasElement: HTMLElement) {
  const paragraph = canvasElement.querySelector("p")!
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)

  const swatch = document.createElement("div")
  swatch.style.backgroundColor = "var(--brand-fill)"
  swatch.style.color = "white"
  canvasElement.append(swatch)
  const expected = getComputedStyle(swatch)

  const selected = getComputedStyle(paragraph, "::selection")
  await expect(selected.backgroundColor).toBe(expected.backgroundColor)
  await expect(selected.color).toBe(expected.color)
  swatch.remove()
}

export const Selection: Story = {
  play: async ({ canvasElement }) => expectBrandSelection(canvasElement),
}

export const SelectionDark: Story = {
  globals: { theme: "dark" },
  parameters: isolatedDocs("560px"),
  play: async ({ canvasElement }) => expectBrandSelection(canvasElement),
}

/**
 * Headings an article's table of contents links to. The icon beside each is the link,
 * so the heading's own text selects like any other text; a click on it still jumps to it.
 */
export const AnchoredHeadings: Story = {
  args: {
    data: stampTableOfContentsAnchors(
      richText(
        createHeadingNode("Why the small races matter", "h2"),
        createParagraph(SENTENCES[0]!),
      ) as DefaultTypedEditorState,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = canvas.getByRole("heading", { level: 2, name: "Why the small races matter" })
    const link = within(heading).getByRole("link", { name: "Why the small races matter" })
    const text = within(heading).getByText("Why the small races matter")
    await expect(link).toHaveAttribute("href", `#${heading.id}`)
    // Dragging across a link drags the link, so the text must not be inside one.
    await expect(text.closest("a")).toBeNull()

    // Drag across the first word: it's selected, and the page doesn't jump.
    const node = text.firstChild!
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: text, node, offset: 0 },
      { target: text, node, offset: 3 },
      { keys: "[/MouseLeft]" },
    ])
    await expect(window.getSelection()?.toString()).toBe("Why")
    await expect(window.location.hash).not.toBe(`#${heading.id}`)

    // A plain click links to the heading.
    window.getSelection()?.removeAllRanges()
    await userEvent.click(text)
    await expect(window.location.hash).toBe(`#${heading.id}`)
    history.replaceState(null, "", window.location.pathname + window.location.search)
  },
}

/**
 * An article's opening paragraph as the article and volume pages set it: Libertinus Serif
 * (the design spec's serif, served to every reader so the page and the map pictures match)
 * at 112%, Georgia's x-height, with the first letter dropped two lines. Chrome sets the drop
 * cap with `initial-letter`; Safari and Firefox float it.
 */
export const DropCap: Story = {
  args: {
    className: "drop-cap",
    data: richText(
      createParagraph([
        createTextNode(`${SENTENCES[0]} `),
        createTextNode("Most of them", TextFormat.Italic),
        createTextNode(` ${SENTENCES[1]}`),
      ] as never),
      createParagraph(SENTENCES[2]),
    ) as DefaultTypedEditorState,
  },
  play: async ({ canvasElement }) => {
    const paragraph = canvasElement.querySelector(".drop-cap > p")
    if (!paragraph) throw new Error("no opening paragraph")
    const family = getComputedStyle(paragraph).fontFamily
    // Every reader gets the same serif, never the system's.
    await expect(family).not.toContain("ui-serif")

    await document.fonts.ready
    const faces = [...document.fonts].filter(
      (face) =>
        face.status === "loaded" && family.includes(face.family.replace(/^["']|["']$/g, "")),
    )
    // The regular face, and the italic the paragraph uses, both arrived and scaled up.
    await expect(faces.map((face) => face.style).sort()).toEqual(
      expect.arrayContaining(["italic", "normal"]),
    )
    // `sizeAdjust` is Chrome's and Firefox's, not yet in TypeScript's DOM types.
    for (const face of faces) {
      await expect((face as FontFace & { sizeAdjust?: string }).sizeAdjust).toBe("112%")
    }
  },
}
