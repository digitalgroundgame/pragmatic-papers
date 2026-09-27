import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Separator } from "./separator"

const meta = {
  title: "UI/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: (args) => (
    <div className="max-w-sm space-y-3 text-sm">
      <p>Volume XII</p>
      <Separator {...args} />
      <p>Issue 3</p>
    </div>
  ),
}

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>Articles</span>
      <Separator {...args} />
      <span>Volumes</span>
      <Separator {...args} />
      <span>Topics</span>
    </div>
  ),
}
