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

/**
 * The byline's prose, without the avatars — an avatar with no image renders
 * the author's initials, which would otherwise sit between the separators and
 * the names ("ASAlice Smith, BJBob Jones").
 */
const bylineText = (container: HTMLElement): string => {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-slot="avatar"]').forEach((avatar) => avatar.remove())
  return clone.textContent ?? ""
}

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

  it("renders with populated authors", () => {
    const article = {
      ...baseArticle,
      authors: [makeAuthor(1, "Alice Smith"), makeAuthor(2, "Bob Jones")],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it("joins three authors with commas and a closing ampersand", () => {
    const article = {
      ...baseArticle,
      authors: [
        makeAuthor(1, "Alice Smith"),
        makeAuthor(2, "Bob Jones"),
        makeAuthor(3, "Carol Diaz"),
      ],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(bylineText(container)).toContain("Alice Smith, Bob Jones & Carol Diaz")
    expect(container.firstChild).toMatchSnapshot()
  })

  it("names every author, however many, with no remainder", () => {
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
    expect(bylineText(container)).toContain(
      "Alice Smith, Bob Jones, Carol Diaz, Dan Reed, Erin Fox & Frank Ng",
    )
    expect(container.textContent).not.toContain("more")
    expect(container.firstChild).toMatchSnapshot()
  })

  it("gives every author their own avatar", () => {
    const article = {
      ...baseArticle,
      authors: [
        makeAuthor(1, "Alice Smith"),
        makeAuthor(2, "Bob Jones"),
        makeAuthor(3, "Carol Diaz"),
        makeAuthor(4, "Dan Reed"),
      ],
    } as unknown as Article
    const { container } = render(<ArticleHero article={article} />)
    expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(4)
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
