import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { SquiggleRuleBlock } from "./Component"

const meta = {
  title: "Blocks/SquiggleRule",
  component: SquiggleRuleBlock,
  args: { blockType: "squiggleRule", variant: "animated", size: "medium" },
  argTypes: {
    variant: { control: "inline-radio", options: ["animated", "static"] },
    size: { control: "inline-radio", options: ["small", "medium", "large", "full"] },
  },
} satisfies Meta<typeof SquiggleRuleBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Animated: Story = {}

export const Static: Story = {
  args: { variant: "static" },
}
