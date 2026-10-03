import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, within } from "storybook/test"

import { authors, topics } from "@/stories/fixtures/docs"
import { createFakePayload } from "@/stories/fixtures/payload"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { Breadcrumbs } from "."

const pages = [{ id: 1, slug: "about", title: "About the Papers" }]

const meta = {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
  beforeEach: () => {
    mocked(getPayloadConfig).mockResolvedValue(
      createFakePayload({ collections: { topics, users: authors, pages } }),
    )
  },
} satisfies Meta<typeof Breadcrumbs>

export default meta
type Story = StoryObj<typeof meta>

export const Topic: Story = {
  args: { pathname: "/topics/courts" },
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "breadcrumb" })
    await expect(within(nav).getByRole("link", { name: "Topics" })).toHaveAttribute(
      "href",
      "/topics",
    )
    await expect(within(nav).getByText("Courts")).toHaveAttribute("aria-current", "page")
  },
}

export const Author: Story = {
  args: { pathname: "/authors/priya-natarajan" },
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "breadcrumb" })
    await expect(within(nav).getByText("Priya Natarajan")).toBeInTheDocument()
  },
}

export const Volume: Story = {
  args: { pathname: "/volumes/12" },
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "breadcrumb" })
    await expect(within(nav).getByText("Volume XII")).toBeInTheDocument()
  },
}

export const Page: Story = {
  args: { pathname: "/about" },
}

export const HiddenOnArticles: Story = {
  args: { pathname: "/articles/school-board-races" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement()
  },
}
