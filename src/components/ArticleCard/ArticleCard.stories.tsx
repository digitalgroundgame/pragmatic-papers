import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, waitFor, within } from "storybook/test"

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

export const Priority: Story = {
  args: { preload: true },
  play: async ({ canvasElement }) => {
    const image = within(canvasElement).getByRole("img")
    await expect(image).toHaveAttribute("fetchpriority", "high")
    await expect(image).not.toHaveAttribute("loading", "lazy")
  },
}

export const Lazy: Story = {
  play: async ({ canvasElement }) => {
    const image = within(canvasElement).getByRole("img")
    await expect(image).toHaveAttribute("loading", "lazy")
    await expect(image).not.toHaveAttribute("fetchpriority")
  },
}

/** Tabbing to the card lifts its image and dims its headline, as pointing at it does. */
export const KeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const image = canvas.getByRole("img")
    const heading = canvas.getByRole("heading")
    await expect(getComputedStyle(image).filter).toBe("none")
    await expect(getComputedStyle(heading).color).not.toMatch(/\/ 0\.8\)$/)

    canvas.getByRole("link").focus()

    await waitFor(() => expect(getComputedStyle(image).filter).toContain("contrast(1.16)"))
    await expect(getComputedStyle(heading).color).toMatch(/\/ 0\.8\)$/)
  },
}
