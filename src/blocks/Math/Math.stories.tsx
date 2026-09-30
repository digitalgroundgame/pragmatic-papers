import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { MathJaxProviderRoot } from "@/providers/MathJaxProvider"

import { MathBlock } from "./Component"

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
  args: {
    blockType: "displayMathBlock",
    math: "a^2 + b^2 = c^2",
  },
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
  args: { blockType: "inlineMathBlock", math: "E = mc^2" },
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
