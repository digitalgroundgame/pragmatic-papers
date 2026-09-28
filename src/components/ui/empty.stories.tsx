import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { SearchX } from "lucide-react"

import { Button } from "./button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty"

const meta = {
  title: "UI/Empty",
  component: Empty,
} satisfies Meta<typeof Empty>

export default meta
type Story = StoryObj<typeof meta>

export const NoResults: Story = {
  render: (args) => (
    <Empty className="border" {...args}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>No articles found</EmptyTitle>
        <EmptyDescription>
          Try a different search, or <a href="/articles">browse all articles</a>.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline">Clear search</Button>
      </EmptyContent>
    </Empty>
  ),
}
