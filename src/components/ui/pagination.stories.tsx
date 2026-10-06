import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination"

const meta = {
  title: "UI/Pagination",
  component: Pagination,
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Pagination {...args}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="/articles/page/1" />
        </PaginationItem>
        {[1, 2, 3].map((page) => (
          <PaginationItem key={page}>
            <PaginationLink href={`/articles/page/${page}`} isActive={page === 2}>
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="/articles/page/12">12</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="/articles/page/3" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "pagination" })
    await expect(within(nav).getByRole("link", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(within(nav).getByRole("link", { name: "Go to next page" })).toHaveAttribute(
      "href",
      "/articles/page/3",
    )
  },
}
