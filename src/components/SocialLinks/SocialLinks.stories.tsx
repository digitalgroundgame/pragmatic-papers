import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { socials } from "@/stories/fixtures/navigation"

import { SocialLinks } from "."

const meta = {
  title: "Components/SocialLinks",
  component: SocialLinks,
  args: { socials },
} satisfies Meta<typeof SocialLinks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Social Links" })
    const bluesky = within(nav).getByRole("link", { name: "Bluesky" })
    await expect(bluesky).toHaveAttribute("target", "_blank")
  },
}

export const Labelled: Story = {
  args: { "aria-label": "Footer Social Links" },
}

export const UnknownPlatform: Story = {
  args: {
    socials: [
      { id: "w", link: { type: "custom", url: "example.org/newsletter", label: "Newsletter" } },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link")).toHaveAttribute(
      "href",
      "https://example.org/newsletter",
    )
  },
}
