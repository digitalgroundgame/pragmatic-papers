import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import { feedArticle, phoneFrame } from "@/stories/fixtures/feed"

import { ArticleView } from "./ArticleView"
import { renderFeedArticle } from "./renderFeedArticle"
import type { RenderedFeedArticle } from "./types"

const rendered = renderFeedArticle(feedArticle())
const total = rendered.pages.length

/** The same article with every page lasting `ms`, so auto-play runs within a test. */
function withDurations(article: RenderedFeedArticle, ms: number): RenderedFeedArticle {
  return { ...article, pages: article.pages.map((page) => ({ ...page, durationMs: ms })) }
}

function currentPage(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole("tab", { selected: true })
}

/** One article in the feed: its pages side by side, the progress bars and byline on top. */
const meta = {
  title: "Feed/ArticleView",
  component: ArticleView,
  globals: { theme: "dark" },
  parameters: { layout: "centered" },
  decorators: [phoneFrame],
  // Paused, so a story holds still unless it turns auto-play on.
  args: {
    article: rendered,
    active: true,
    initialPage: 0,
    autoPlayEnabled: false,
    userAutoPlayEnabled: false,
    onAutoPlayToggle: fn(),
    onPageChange: fn(),
    onEndReached: fn(),
  },
} satisfies Meta<typeof ArticleView>

export default meta
type Story = StoryObj<typeof meta>

/** Opens on the hero; the byline stays hidden until the reader leaves it. */
export const Hero: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("tab")).toHaveLength(total)
    await expect(currentPage(canvasElement)).toHaveAccessibleName(`Go to page 1 of ${total}`)
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      rendered.article.title,
    )
  },
}

/** Deep links (`?p=2`) and returning to an article open on the remembered page. */
export const OpensOnRememberedPage: Story = {
  args: { initialPage: 2 },
  play: async ({ args, canvasElement }) => {
    await waitFor(() =>
      expect(currentPage(canvasElement)).toHaveAccessibleName(`Go to page 3 of ${total}`),
    )
    await expect(args.onPageChange).toHaveBeenLastCalledWith(2)
  },
}

/** Tapping a segment jumps to that page, forwards and back. */
export const TapSegmentToJump: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("tab", { name: `Go to page ${total} of ${total}` }))
    await waitFor(() => expect(args.onPageChange).toHaveBeenLastCalledWith(total - 1))
    await expect(currentPage(canvasElement)).toHaveAccessibleName(`Go to page ${total} of ${total}`)

    await userEvent.click(canvas.getByRole("tab", { name: `Go to page 2 of ${total}` }))
    await waitFor(() => expect(args.onPageChange).toHaveBeenLastCalledWith(1))
    // Tapping a segment is navigation, not a tap on the page: auto-play keeps its state.
    await expect(args.onAutoPlayToggle).not.toHaveBeenCalled()
  },
}

/** ← and → page through the article on screen. */
export const KeyboardPaging: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.keyboard("{ArrowRight}")
    await waitFor(() => expect(args.onPageChange).toHaveBeenLastCalledWith(1))
    // Off the hero, the byline names the article for screen readers too.
    const byline = within(canvasElement).getByText(`${rendered.article.title} · Jordan Rivera`)
    await expect(byline.closest("[aria-hidden='true']")).not.toBeInTheDocument()
    await userEvent.keyboard("{ArrowLeft}")
    await waitFor(() => expect(args.onPageChange).toHaveBeenLastCalledWith(0))
  },
}

/** Focused on a segment, the arrow keys move one page, and focus follows. */
export const KeyboardSegments: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole("tab", { selected: true }).focus()
    await userEvent.keyboard("{ArrowRight}")
    await waitFor(() => expect(args.onPageChange).toHaveBeenLastCalledWith(1))
    await expect(canvas.getByRole("tab", { name: `Go to page 2 of ${total}` })).toHaveFocus()
    await expect(canvas.getByRole("tab", { name: `Go to page 2 of ${total}` })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  },
}

/** Tapping the page itself pauses or resumes auto-play. */
export const TapToToggleAutoPlay: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("heading", { level: 1 }))
    await expect(args.onAutoPlayToggle).toHaveBeenCalledOnce()
  },
}

/** With auto-play on, each page advances once its time is up. */
export const AutoPlayAdvances: Story = {
  args: {
    article: withDurations(rendered, 300),
    autoPlayEnabled: true,
    userAutoPlayEnabled: true,
  },
  play: async ({ args }) => {
    await waitFor(() => expect(args.onPageChange).toHaveBeenCalledWith(1), { timeout: 3000 })
  },
}

/** On the last page, running out of time moves the feed to the next article. */
export const AutoPlayEndsArticle: Story = {
  args: {
    article: withDurations(rendered, 300),
    initialPage: total - 1,
    autoPlayEnabled: true,
    userAutoPlayEnabled: true,
  },
  play: async ({ args }) => {
    await waitFor(() => expect(args.onEndReached).toHaveBeenCalled(), { timeout: 3000 })
  },
}

/** An article with no body is just its hero: no progress bar to page through. */
export const HeroOnly: Story = {
  args: { article: renderFeedArticle(feedArticle({}, [])) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("tablist")).not.toBeInTheDocument()
  },
}
