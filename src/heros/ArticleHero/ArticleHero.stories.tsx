import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { knownContrastIssue } from "@/stories/a11y"
import { articleFixture, authors } from "@/stories/fixtures/docs"
import { narrationAudio } from "@/stories/fixtures/media"

import { ArticleHero } from "."

const meta = {
  title: "Heros/ArticleHero",
  component: ArticleHero,
  parameters: { layout: "fullscreen", ...knownContrastIssue },
  args: {
    article: articleFixture({
      authors: authors.slice(0, 2),
      publishedAt: "2026-01-12T15:00:00.000Z",
      updatedAt: "2026-01-12T15:00:00.000Z",
    }),
  },
  decorators: [
    (Story) => (
      <div className="container max-w-3xl py-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      "The school board races nobody is watching",
    )
    await userEvent.hover(canvasElement.querySelector("#article-dateline")!)
    await waitFor(() =>
      expect(document.querySelector("[data-slot=tooltip-content]")).toHaveTextContent(/2026/),
    )
  },
}

export const Updated: Story = {
  args: {
    article: articleFixture({
      authors: authors.slice(0, 1),
      publishedAt: "2026-01-12T15:00:00.000Z",
      updatedAt: "2026-01-14T09:30:00.000Z",
    }),
  },
}

export const WithNarration: Story = {
  args: {
    article: articleFixture({
      authors: authors.slice(0, 3),
      narration: { ...narrationAudio, narrator: authors[1] },
    }),
  },
}
