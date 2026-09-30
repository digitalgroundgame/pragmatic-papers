import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { MegaMenu } from "@/components/MegaMenu"
import { navItems } from "@/stories/fixtures/navigation"

import { Menu } from "."

const meta = {
  title: "Components/Menu",
  component: Menu,
  args: { menu: navItems, label: "Main", layout: "responsive" },
  argTypes: {
    layout: { control: "inline-radio", options: ["inline", "stacked", "responsive"] },
  },
  parameters: { nextjs: { navigation: { pathname: "/volumes" } } },
} satisfies Meta<typeof Menu>

export default meta
type Story = StoryObj<typeof meta>

export const Responsive: Story = {
  play: async ({ canvasElement }) => {
    const current = within(canvasElement).getByRole("link", { name: "Volumes" })
    await expect(current).toHaveAttribute("aria-current", "page")
    await expect(within(canvasElement).getByRole("link", { name: "Articles" })).not.toHaveAttribute(
      "aria-current",
    )
  },
}

export const Inline: Story = {
  args: { layout: "inline" },
}

export const Stacked: Story = {
  args: { layout: "stacked" },
  decorators: [
    (Story) => (
      <div className="max-w-xs border">
        <Story />
      </div>
    ),
  ],
}

export const Mega: Story = {
  render: (args) => <MegaMenu menu={args.menu} label={args.label} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link", { name: "Volumes" })).toHaveAttribute(
      "aria-current",
      "page",
    )
  },
}
