import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { knownContrastIssue } from "@/stories/a11y"

import { Badge } from "./badge"

const variants = [
  "default",
  "brand",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const

const meta = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "Politics" },
  argTypes: {
    variant: { control: "select", options: variants },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
  parameters: knownContrastIssue,
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {variants.map((variant) => (
        <Badge key={variant} {...args} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
}

export const AsLink: Story = {
  args: { variant: "outline", render: <a href="/topics/politics" /> },
}
