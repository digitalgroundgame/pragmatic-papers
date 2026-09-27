import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { headers } from "@storybook/nextjs-vite/headers.mock"
import { expect, mocked, within } from "storybook/test"

import { authors, topics } from "@/stories/fixtures/docs"
import { createFakePayload } from "@/stories/fixtures/payload"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { Breadcrumbs } from "."

function atPath(pathname: string) {
  return () => {
    headers().set("x-pathname", pathname)
    mocked(getPayloadConfig).mockResolvedValue(
      createFakePayload({
        collections: {
          topics,
          users: authors,
          pages: [{ id: 1, slug: "about", title: "About the Papers" }],
        },
      }),
    )
  }
}

const meta = {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} satisfies Meta<typeof Breadcrumbs>

export default meta
type Story = StoryObj<typeof meta>

export const Topic: Story = {
  beforeEach: atPath("/topics/courts"),
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
  beforeEach: atPath("/authors/priya-natarajan"),
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "breadcrumb" })
    await expect(within(nav).getByText("Priya Natarajan")).toBeInTheDocument()
  },
}

export const Volume: Story = {
  beforeEach: atPath("/volumes/12"),
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "breadcrumb" })
    await expect(within(nav).getByText("Volume XII")).toBeInTheDocument()
  },
}

export const Page: Story = {
  beforeEach: atPath("/about"),
}

export const HiddenOnArticles: Story = {
  beforeEach: atPath("/articles/school-board-races"),
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement()
  },
}
