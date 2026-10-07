import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { brandFillContrastIssue } from "@/stories/a11y"

import { LinkButton } from "./link-button"

const meta = {
  title: "UI/LinkButton",
  component: LinkButton,
  args: { href: "/articles", children: "All articles" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "link", "branded"],
    },
    size: { control: "select", options: ["xs", "sm", "default", "lg"] },
  },
} satisfies Meta<typeof LinkButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "All articles" })
    await expect(link).toHaveAttribute("href", "/articles")
  },
}

export const Branded: Story = {
  args: { variant: "branded", size: "lg", children: "Subscribe" },
  parameters: brandFillContrastIssue,
}

export const Outline: Story = {
  args: { variant: "outline" },
}
