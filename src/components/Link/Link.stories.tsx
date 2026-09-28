import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { CMSButton } from "@/components/Button"
import { articles } from "@/stories/fixtures/docs"

import { CMSLink } from "./CMSLink2"

const meta = {
  title: "Components/CMSLink",
  component: CMSLink,
  args: { link: { type: "custom", url: "https://example.com", label: "An external page" } },
} satisfies Meta<typeof CMSLink>

export default meta
type Story = StoryObj<typeof meta>

export const Custom: Story = {}

export const NewTab: Story = {
  args: {
    link: { type: "custom", url: "https://example.com", label: "Opens in a new tab", newTab: true },
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link")
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
  },
}

export const Reference: Story = {
  args: {
    link: {
      type: "reference",
      label: "Read the article",
      reference: { relationTo: "articles", value: articles[0]! },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link")).toHaveAttribute(
      "href",
      "/articles/article-1",
    )
  },
}

export const Unresolvable: Story = {
  args: { link: { type: "reference", label: "Nowhere", reference: null } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement()
  },
}

export const AsButton: Story = {
  render: (args) => (
    <div className="flex gap-2">
      <CMSButton link={args.link} />
      <CMSButton link={args.link} variant="outline" />
      <CMSButton link={args.link} variant="ghost" />
    </div>
  ),
}
