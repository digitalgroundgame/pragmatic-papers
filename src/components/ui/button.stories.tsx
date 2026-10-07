import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ArrowRight, Plus } from "lucide-react"
import { expect, fn, userEvent, within } from "storybook/test"

import { brandFillContrastIssue } from "@/stories/a11y"

import { Button } from "./button"

const variants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
  "branded",
  "disabled",
] as const

const sizes = ["xs", "sm", "default", "lg"] as const

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Read the article", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: variants },
    size: {
      control: "select",
      options: [...sizes, "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"))
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}

export const Variants: Story = {
  parameters: brandFillContrastIssue,
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {variants.map((variant) => (
        <Button key={variant} {...args} variant={variant} disabled={variant === "disabled"}>
          {variant}
        </Button>
      ))}
    </div>
  ),
}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {sizes.map((size) => (
        <Button key={size} {...args} size={size}>
          {size}
        </Button>
      ))}
    </div>
  ),
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        Continue <ArrowRight data-icon="inline-end" />
      </>
    ),
  },
}

export const IconOnly: Story = {
  args: { size: "icon", "aria-label": "Add", children: <Plus /> },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button")
    await expect(button).toBeDisabled()
    await userEvent.click(button, { pointerEventsCheck: 0 })
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}
