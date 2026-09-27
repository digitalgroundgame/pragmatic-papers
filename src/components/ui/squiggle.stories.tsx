import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Squiggle, SquiggleStatic } from "./squiggle"

const meta = {
  title: "UI/Squiggle",
  component: Squiggle,
  args: { size: "medium" },
  argTypes: {
    size: { control: "inline-radio", options: ["small", "medium", "large", "full"] },
  },
} satisfies Meta<typeof Squiggle>

export default meta
type Story = StoryObj<typeof meta>

export const Animated: Story = {}

export const Static: Story = {
  render: (args) => <SquiggleStatic {...args} />,
}

export const Sizes: Story = {
  render: () => (
    <div>
      {(["small", "medium", "large", "full"] as const).map((size) => (
        <Squiggle key={size} size={size} />
      ))}
    </div>
  ),
}
