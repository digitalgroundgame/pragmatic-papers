import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { createHeadingNode, createParagraph, createRichText } from "@/utilities/lexical"

import { PageShell } from "."
import { SitePageHeader } from "./SitePageHeader"

const meta = {
  title: "Components/PageShell/SitePageHeader",
  component: SitePageHeader,
  args: { title: "Topics", description: "Browse all topics" },
  decorators: [
    (Story) => (
      <PageShell as="div">
        <Story />
      </PageShell>
    ),
  ],
} satisfies Meta<typeof SitePageHeader>

export default meta
type Story = StoryObj<typeof meta>

/** The route's own title and line, while its site page isn't published. */
export const BeforeThePage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Topics")
    await expect(canvas.getByText("Browse all topics")).toBeInTheDocument()
  },
}

/** The page's hero text, which editors own: its h1 and introduction. */
export const FromThePage: Story = {
  args: {
    hero: {
      type: "pageHero",
      richText: createRichText([
        createHeadingNode("Topics", "h1"),
        createParagraph("Everything we write about, with how much we've written on each."),
      ]),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await expect(canvas.queryByText("Browse all topics")).not.toBeInTheDocument()
  },
}
