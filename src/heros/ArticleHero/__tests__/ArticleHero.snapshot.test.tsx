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
  authors: null,
  narration: null,
} as unknown as Article

describe("ArticleHero", () => {
  it("renders without authors or hero image", () => {
    const { container } = render(<ArticleHero article={baseArticle} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders with populated authors showing avatar stack", () => {
    const article = {
      ...baseArticle,
      authors: [makeAuthor(1, "Alice Smith"), makeAuthor(2, "Bob Jones")],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("joins three authors with an Oxford comma and ampersand", () => {
    const article = {
      ...baseArticle,
      authors: [
        makeAuthor(1, "Alice Smith"),
        makeAuthor(2, "Bob Jones"),
        makeAuthor(3, "Carol Diaz"),
      ],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.textContent).toContain("Alice Smith, Bob Jones, & Carol Diaz")
    expect(container.firstChild).toMatchSnapshot()
  })

  it("names every author when the byline is at its cap", () => {
    const article = {
      ...baseArticle,
      authors: [
        makeAuthor(1, "Alice Smith"),
        makeAuthor(2, "Bob Jones"),
        makeAuthor(3, "Carol Diaz"),
      ],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.textContent).not.toContain("more")
  })

  it("collapses authors past the cap into a remainder", () => {
    const article = {
      ...baseArticle,
      authors: [
        makeAuthor(1, "Alice Smith"),
        makeAuthor(2, "Bob Jones"),
        makeAuthor(3, "Carol Diaz"),
        makeAuthor(4, "Dan Reed"),
        makeAuthor(5, "Erin Fox"),
        makeAuthor(6, "Frank Ng"),
      ],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.textContent).toContain("Alice Smith, Bob Jones, Carol Diaz, & 3 more")
    expect(container.textContent).not.toContain("Dan Reed")
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

  it("renders narration as numeric id (no player shown)", () => {
    const article = { ...baseArticle, narration: 7 } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("renders narration as object (shows player)", () => {
    const article = {
      ...baseArticle,
      narration: { id: 7, filename: "narration.mp3" },
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
