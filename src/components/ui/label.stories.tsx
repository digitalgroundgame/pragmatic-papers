import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "UI/Label",
  component: Label,
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="name" {...args} />
      <Input id="name" />
    </div>
  ),
  args: { children: "Full name" },
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
