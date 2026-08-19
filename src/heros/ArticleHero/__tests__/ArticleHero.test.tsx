import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ArticleHero } from "../index"
import type * as MediaModule from "@/components/Media"
import type { Article, User } from "@/payload-types"

// Only the renderer is stubbed — the real is*Media guards decide what ArticleHero shows.
vi.mock("@/components/Media", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaModule>()),
  Media: ({ media }: { media: { filename: string } }) => (
    <div data-testid="media">{media?.filename}</div>
  ),
}))

vi.mock("@/components/NarrationPlayer", () => ({
  NarrationPlayer: () => <div data-testid="narration-player" />,
}))

vi.mock("@/components/ShareButtons", () => ({
  ShareButtons: ({ url, title }: { url: string; title: string }) => (
    <div data-testid="share-buttons" data-url={url} data-title={title} />
  ),
}))

vi.mock("@/utilities/getURL", () => ({
  getServerSideURL: () => "https://example.com",
}))

afterEach(cleanup)

const baseArticle: Article = {
  id: 1,
  title: "Test Article",
  slug: "test-article",
  updatedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  publishedAt: "2024-06-15T12:00:00.000Z",
  content: {
    root: { type: "root", children: [], direction: null, format: "", indent: 0, version: 1 },
  },
}

describe("ArticleHero", () => {
  it("renders the article title", () => {
    render(<ArticleHero article={baseArticle} />)
    expect(screen.getByRole("heading", { name: "Test Article" })).toBeTruthy()
  })

  it("renders ShareButtons with the correct url and title", () => {
    render(<ArticleHero article={baseArticle} />)
    const shareButtons = screen.getByTestId("share-buttons")
    expect(shareButtons.getAttribute("data-url")).toBe("https://example.com/articles/test-article")
    expect(shareButtons.getAttribute("data-title")).toBe("Test Article")
  })

  it("does not render Media when heroImage is absent", () => {
    render(<ArticleHero article={baseArticle} />)
    expect(screen.queryByTestId("media")).toBeNull()
  })

  it("renders populated authors as links", () => {
    const article: Article = {
      ...baseArticle,
      authors: [
        { id: 1, name: "Alice", slug: "alice", affiliation: null },
        { id: 2, name: "Bob", slug: "bob", affiliation: null },
      ] as User[],
    }
    render(<ArticleHero article={article} />)
    const aliceLink = screen.getByRole("link", { name: "Alice" }) as HTMLAnchorElement
    expect(aliceLink.href).toContain("/authors/alice")
  })

  it("renders Media when heroImage is present", () => {
    const article: Article = {
      ...baseArticle,
      heroImage: {
        id: 10,
        filename: "hero.jpg",
        mimeType: "image/jpeg",
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    }
    render(<ArticleHero article={article} />)
    expect(screen.getByTestId("media")).toBeTruthy()
  })

  it("does not render NarrationPlayer when narration is absent", () => {
    render(<ArticleHero article={baseArticle} />)
    expect(screen.queryByTestId("narration-player")).toBeNull()
  })

  it("renders NarrationPlayer when narration is a media object", () => {
    const article: Article = {
      ...baseArticle,
      narration: {
        id: 20,
        filename: "narration.mp3",
        mimeType: "audio/mpeg",
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    }
    render(<ArticleHero article={article} />)
    expect(screen.getByTestId("narration-player")).toBeTruthy()
  })

  it("does not render NarrationPlayer when narration is a number (unresolved relation)", () => {
    const article: Article = { ...baseArticle, narration: 20 }
    render(<ArticleHero article={article} />)
    expect(screen.queryByTestId("narration-player")).toBeNull()
  })

  it("does not render NarrationPlayer when narration is not audio", () => {
    const article: Article = {
      ...baseArticle,
      narration: {
        id: 21,
        filename: "narration.mp4",
        mimeType: "video/mp4",
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    }
    render(<ArticleHero article={article} />)
    expect(screen.queryByTestId("narration-player")).toBeNull()
  })

  it("places the narration player before the share buttons in the DOM", () => {
    const article: Article = {
      ...baseArticle,
      narration: {
        id: 20,
        filename: "narration.mp3",
        mimeType: "audio/mpeg",
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    }
    render(<ArticleHero article={article} />)
    const narration = screen.getByTestId("narration-player")
    const share = screen.getByTestId("share-buttons")
    // Keyboard focus follows DOM order, and the player is read before the share
    // buttons on md and up.
    expect(narration.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("matches snapshot", () => {
    const { container } = render(<ArticleHero article={baseArticle} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
