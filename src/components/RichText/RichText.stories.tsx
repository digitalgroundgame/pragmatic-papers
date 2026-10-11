import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { MathJaxProviderRoot } from "@/providers/MathJaxProvider"
import { landscapeImage, mediaFixture, portraitImage } from "@/stories/fixtures/media"
import {
  articleBody,
  createLinkNode,
  createParagraph,
  createTextNode,
  richText,
  SENTENCES,
  TextFormat,
} from "@/stories/fixtures/richText"

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
