import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articles, volumes } from "@/stories/fixtures/docs"

import { AuthorArticleCard } from "./AuthorArticleCard"

const meta = {
  title: "Components/AuthorArticleCard",
  component: AuthorArticleCard,
  args: { article: articles[0]! },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthorArticleCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithVolume: Story = {
  args: { volume: volumes[0] },
}

export const NoImage: Story = {
  args: { article: { ...articles[2]!, meta: { ...articles[2]!.meta, image: null } } },
}
