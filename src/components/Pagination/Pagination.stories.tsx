import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { PageRange } from "@/components/PageRange"
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

export const FirstPage: Story = {
  args: { page: 1 },
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "pagination" })
    await expect(
      within(nav).queryByRole("link", { name: "Go to previous page" }),
    ).not.toBeInTheDocument()
    await expect(within(nav).getByText("Previous").closest("a")).not.toHaveAttribute("href")
  },
}

export const LastPage: Story = {
  args: { page: 8 },
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole("navigation", { name: "pagination" })
    await expect(
      within(nav).queryByRole("link", { name: "Go to next page" }),
    ).not.toBeInTheDocument()
    await expect(within(nav).getByText("Next").closest("a")).not.toHaveAttribute("href")
  },
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
