import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { MathJaxProviderRoot } from "@/providers/MathJaxProvider"
import { knownContrastIssue } from "@/stories/a11y"
import { landscapeImage } from "@/stories/fixtures/media"
import {
  articleBody,
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
  parameters: knownContrastIssue,
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
