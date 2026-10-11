import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { createHeadingNode, createParagraph, richText } from "@/stories/fixtures/richText"

import { CallToActionBlock } from "./Component"

const meta = {
  title: "Blocks/CallToAction",
  component: CallToActionBlock,
  args: {
    id: "cta-story",
    blockType: "cta",
    richText: richText(
      createHeadingNode("Get every volume in your inbox", "h3"),
      createParagraph("One email a week. No ads, no tracking, unsubscribe any time."),
    ),
    links: [
      {
        link: { type: "custom", url: "/newsletter", label: "Subscribe" },
      },
    ],
  },
} satisfies Meta<typeof CallToActionBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = canvas.getByRole("heading", {
      level: 3,
      name: "Get every volume in your inbox",
    })
    // The card is always dark, so its text stays white in light mode too.
    await expect(heading).toHaveStyle({ color: "rgb(255, 255, 255)" })
    await expect(canvas.getByText(/One email a week/)).toHaveStyle({ color: "rgb(255, 255, 255)" })
    const link = canvas.getByRole("link", { name: "Subscribe" })
    await expect(link).toHaveAttribute("href", "/newsletter")
  },
}

/** A call to action saved without buttons still shows its text. */
export const WithoutLinks: Story = {
  args: { links: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 3 })).toBeInTheDocument()
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument()
  },
}

export const TwoLinks: Story = {
  args: {
    links: [
      { link: { type: "custom", url: "/newsletter", label: "Subscribe" } },
      { link: { type: "custom", url: "/volumes", label: "Browse volumes" } },
    ],
  },
  play: async ({ canvasElement }) => {
    const links = within(canvasElement).getAllByRole("link")
    await expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/newsletter",
      "/volumes",
    ])
  },
}
