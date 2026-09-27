import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { PageRange } from "@/components/PageRange"
import { skipA11yRules } from "@/stories/a11y"
import { PaginationVolumes } from "@/components/PaginationVolumes"

import { Pagination } from "."

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  args: { page: 3, totalPages: 8 },
  argTypes: {
    page: { control: { type: "number", min: 1 } },
    totalPages: { control: { type: "number", min: 1 } },
  },
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

export const Middle: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "pagination" })
    await expect(within(nav).getByRole("link", { name: "3" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(within(nav).getByRole("link", { name: "Go to next page" })).toHaveAttribute(
      "href",
      "?p=4",
    )
  },
}

// #1001: the boundary Previous/Next are half-opacity live links.
export const FirstPage: Story = {
  args: { page: 1 },
  parameters: skipA11yRules("color-contrast"),
}

export const LastPage: Story = {
  args: { page: 8 },
  parameters: skipA11yRules("color-contrast"),
}

export const CustomHrefs: Story = {
  args: { buildHref: (page) => `/search/page/${page}?q=turnout` },
}

export const Volumes: Story = {
  render: (args) => <PaginationVolumes page={args.page} totalPages={args.totalPages} />,
}

export const Range: Story = {
  render: () => (
    <div className="space-y-2">
      <PageRange collection="articles" currentPage={2} limit={12} totalDocs={40} />
      <PageRange collection="volumes" currentPage={1} limit={12} totalDocs={1} />
      <PageRange totalDocs={0} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent("Showing 13 - 24 of 40 Articles")
    await expect(canvasElement).toHaveTextContent("Showing 1 - 1 of 1 Volume")
    await expect(canvasElement).toHaveTextContent("Search produced no results.")
  },
}
