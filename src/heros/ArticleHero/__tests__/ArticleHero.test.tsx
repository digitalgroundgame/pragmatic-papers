import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ArticleHero } from "../index"
import type * as MediaModule from "@/components/Media"
import type { Article, User } from "@/payload-types"

// Media and NarrationPlayer each decide for themselves whether their input is
// renderable, so the stubs record what the hero handed them rather than
// standing in for that judgement — see their own suites for the guards.
vi.mock("@/components/Media", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaModule>()),
  Media: ({ media }: { media?: { filename?: string } | number | null }) => (
    <div
      data-testid="media"
      data-media={typeof media === "object" ? media?.filename : String(media)}
    />
  ),
}))

vi.mock("@/components/NarrationPlayer", () => ({
  NarrationPlayer: ({ narration }: { narration?: { filename?: string } | number | null }) => (
    <div
      data-testid="narration-player"
      data-narration={typeof narration === "object" ? narration?.filename : String(narration)}
    />
  ),
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
    expect(screen.getByRole("heading", { name: "Test Article" })).toBeInTheDocument()
  })

  it("renders ShareButtons with the correct url and title", () => {
    render(<ArticleHero article={baseArticle} />)
    const shareButtons = screen.getByTestId("share-buttons")
    expect(shareButtons).toHaveAttribute("data-url", "https://example.com/articles/test-article")
    expect(shareButtons).toHaveAttribute("data-title", "Test Article")
  })

  it("hands the hero image to Media, which decides whether to render it", () => {
    expect(baseArticle.heroImage).toBeUndefined()
    render(<ArticleHero article={baseArticle} />)
    expect(screen.getByTestId("media")).toHaveAttribute("data-media", "undefined")
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
    expect(screen.getByTestId("media")).toHaveAttribute("data-media", "hero.jpg")
  })

  it("hands the narration to NarrationPlayer, which decides whether to render it", () => {
    const article: Article = { ...baseArticle, narration: 20 }
    render(<ArticleHero article={article} />)
    // An unresolved relation reaches the player untouched; the player is what
    // rejects it (see NarrationPlayer.test.tsx).
    expect(screen.getByTestId("narration-player")).toHaveAttribute("data-narration", "20")
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
    expect(screen.getByTestId("narration-player")).toHaveAttribute(
      "data-narration",
      "narration.mp3",
    )
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
    // buttons in both of the row's layouts — grouped at the right edge, and
    // spread apart once they wrap onto their own line.
    expect(narration.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("stamps the article with its publication date", () => {
    render(<ArticleHero article={baseArticle} />)
    expect(screen.getByText("June 15, 2024")).toBeInTheDocument()
  })

  it("matches snapshot", () => {
    const { container } = render(<ArticleHero article={baseArticle} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
