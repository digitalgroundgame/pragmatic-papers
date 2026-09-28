import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { articles } from "@/stories/fixtures/docs"

import { ArticleCard } from "."

const meta = {
  title: "Components/ArticleCard",
  component: ArticleCard,
  args: { doc: articles[0], relationTo: "articles" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link")
    await expect(link).toHaveAttribute("href", "/articles/article-1")
  },
}

export const TitleOverride: Story = {
  args: { title: "A headline written for the homepage" },
}

export const NoImage: Story = {
  args: { doc: { ...articles[1]!, meta: { ...articles[1]!.meta, image: null } } },
}
