import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Article } from "@/payload-types"

import { ArticleHero } from "../index"

vi.mock("@/components/Media", () => ({
  Media: () => <div data-testid="media" />,
}))

vi.mock("@/components/NarrationPlayer", () => ({
  NarrationPlayer: () => <div data-testid="narration-player" />,
}))

const makeAuthor = (id: number, name: string) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  profileImage: null,
})

const baseArticle = {
  id: 1,
  title: "Test Article",
  slug: "test-article",
  publishedAt: "2024-06-01T00:00:00.000Z",
  heroImage: null,
  populatedAuthors: null,
  narration: null,
  populatedNarrator: null,
} as unknown as Article

describe("ArticleHero", () => {
  it("renders without authors or hero image", () => {
    const { container } = render(<ArticleHero article={baseArticle} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with populated authors showing avatar stack", () => {
    const article = {
      ...baseArticle,
      populatedAuthors: [makeAuthor(1, "Alice Smith"), makeAuthor(2, "Bob Jones")],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with hero image", () => {
    const article = {
      ...baseArticle,
      heroImage: { id: 99, mimeType: "image/jpeg" },
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
