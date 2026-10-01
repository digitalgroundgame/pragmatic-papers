import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { MathJaxProviderRoot } from "@/providers/MathJaxProvider"
import { FeedHTML } from "@/stories/FeedHTML"
import { displayMathBlock, inlineMathBlock } from "@/stories/fixtures/blocks"

import { MathBlock } from "./Component"
import {
  displayMathToCode,
  displayMathToHTML,
  inlineMathToCode,
  inlineMathToHTML,
} from "./converters"

const meta = {
  title: "Blocks/Math",
  component: MathBlock,
  decorators: [
    (Story) => (
      <MathJaxProviderRoot>
        <Story />
      </MathJaxProviderRoot>
    ),
  ],
  args: displayMathBlock,
  argTypes: {
    blockType: {
      control: "inline-radio",
      options: ["displayMathBlock", "inlineMathBlock"],
    },
  },
} satisfies Meta<typeof MathBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Display: Story = {}

export const DisplayWithDescription: Story = {
  args: { description: "the Pythagorean theorem" },
  play: async ({ canvasElement }) => {
    const math = await within(canvasElement).findByRole("math", {
      name: "the Pythagorean theorem",
    })
    await expect(math.tagName).toBe("DIV")
    await expect(math.firstElementChild).toHaveAttribute("aria-hidden", "true")
  },
}

export const Inline: Story = {
  args: inlineMathBlock,
  render: (args) => (
    <p>
      Einstein showed that <MathBlock {...args} /> in 1905.
    </p>
  ),
}

export const InlineWithDescription: Story = {
  ...Inline,
  args: { ...Inline.args, description: "mass-energy equivalence" },
  play: async ({ canvasElement }) => {
    const math = await within(canvasElement).findByRole("math", {
      name: "mass-energy equivalence",
    })
    await expect(math.tagName).toBe("SPAN")
  },
}

/**
 * Math in the feeds: MathJax delimiters for RSS readers that typeset them,
 * and the LaTeX source as code for Substack, which can't.
 */
export const Feed: Story = {
  render: () => (
    <FeedHTML
      html={[
        displayMathToHTML(displayMathBlock),
        `<p>Einstein showed that ${inlineMathToHTML(inlineMathBlock)} in 1905.</p>`,
        displayMathToCode(displayMathBlock),
        `<p>Einstein showed that ${inlineMathToCode(inlineMathBlock)} in 1905.</p>`,
      ].join("")}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("pre code")).toHaveTextContent(displayMathBlock.math)
    await expect(canvasElement.querySelector("p code")).toHaveTextContent(inlineMathBlock.math)
  },
}
