import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, waitFor, within } from "storybook/test"

import type { RecommendedArticleCandidate } from "@/app/(frontend)/recommended-articles.json/route"
import { articles } from "@/stories/fixtures/docs"

import { RecommendedArticles } from "."

const candidates = articles.slice(0, 6).map((article, i): RecommendedArticleCandidate => ({
  slug: article.slug,
  title: article.title,
  metaImage: article.meta?.image as RecommendedArticleCandidate["metaImage"],
  metaDescription: article.meta?.description ?? null,
  publishedAt: article.publishedAt ?? null,
  engagementScore: 6 - i,
}))

function respondWith(response: () => Promise<Response>) {
  return () => {
    const fetchSpy = spyOn(window, "fetch").mockImplementation(response)
    return () => fetchSpy.mockRestore()
  }
}

const meta = {
  title: "Components/RecommendedArticles",
  component: RecommendedArticles,
  parameters: { layout: "fullscreen" },
  args: { currentArticleSlug: articles[0]!.slug },
} satisfies Meta<typeof RecommendedArticles>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = {
  beforeEach: respondWith(async () => new Response(JSON.stringify({ candidates }))),
  play: async ({ args, canvasElement }) => {
    const section = within(canvasElement).getByRole("region", { name: "Recommended articles" })
    const links = await within(section).findAllByRole("link")
    await expect(links).toHaveLength(4)
    for (const link of links) {
      await expect(link).not.toHaveAttribute("href", `/articles/${args.currentArticleSlug}`)
    }
  },
}

export const Loading: Story = {
  beforeEach: respondWith(() => new Promise<Response>(() => undefined)),
}

export const Unavailable: Story = {
  beforeEach: respondWith(async () => new Response("", { status: 500 })),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement).toBeEmptyDOMElement())
  },
}
