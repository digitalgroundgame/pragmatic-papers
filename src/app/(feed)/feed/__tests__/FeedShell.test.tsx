import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RenderedFeedArticle } from "../types"
import { makeSummary } from "./fixtures"

// The children are covered by their own tests; stub them so these tests see
// only the shell's job: which slots exist, which are mounted, and paging.
vi.mock("../ArticleView", () => ({
  ArticleView: (props: {
    article: RenderedFeedArticle
    active: boolean
    initialPage: number
    autoPlayEnabled: boolean
  }) => (
    <div
      data-testid="article"
      data-id={props.article.article.id}
      data-active={props.active}
      data-page={props.initialPage}
      data-autoplay={props.autoPlayEnabled}
    />
  ),
}))
vi.mock("../AdSlotView", () => ({
  AdSlotView: ({ ad }: { ad: { id: string } }) => <div data-testid="ad" data-id={ad.id} />,
}))
const loadFeedBatch = vi.fn()
vi.mock("../actions", () => ({ loadFeedBatch: (cursor: number) => loadFeedBatch(cursor) }))

const { FeedShell } = await import("../FeedShell")

const item = (id: number): RenderedFeedArticle => ({
  article: makeSummary({ id, slug: `article-${id}` }),
  pages: [{ kind: "hero", durationMs: 1000 }],
  bodies: [null],
})
const items = (...ids: number[]) => ids.map(item)

describe("FeedShell", () => {
  beforeEach(() => {
    loadFeedBatch.mockReset().mockResolvedValue({ items: [], nextCursor: null })
  })

  it("puts an ad after every fifth article", () => {
    const { container } = render(
      <FeedShell initialItems={items(1, 2, 3, 4, 5, 6)} initialNextCursor={null} />,
    )
    // Six articles plus one ad slot.
    expect(container.querySelectorAll("section[data-idx]")).toHaveLength(7)
  })

  it("mounts only the active slot and its neighbours", () => {
    render(<FeedShell initialItems={items(1, 2, 3, 4)} initialNextCursor={null} />)

    const mounted = screen.getAllByTestId("article")
    expect(mounted.map((el) => el.dataset.id)).toEqual(["1", "2"])
    expect(mounted[0]).toHaveAttribute("data-active", "true")
    expect(mounted[1]).toHaveAttribute("data-active", "false")
  })

  it("opens a deep-linked article on its page", () => {
    render(
      <FeedShell
        initialItems={items(7, 2)}
        initialNextCursor={null}
        initialPinnedArticleId={7}
        initialPageIndex={3}
      />,
    )
    expect(screen.getAllByTestId("article")[0]).toHaveAttribute("data-page", "3")
  })

  it("loads the next batch near the end, skipping articles it already has", async () => {
    loadFeedBatch.mockResolvedValue({ items: items(2, 3), nextCursor: null })

    render(<FeedShell initialItems={items(1, 2)} initialNextCursor={2} />)

    expect(loadFeedBatch).toHaveBeenCalledWith(2)
    await vi.waitFor(() => {
      expect(document.querySelectorAll("section[data-idx]")).toHaveLength(3)
    })
    expect(loadFeedBatch).toHaveBeenCalledOnce()
  })

  describe("when loading more fails", () => {
    const reload = vi.fn()

    beforeEach(() => {
      sessionStorage.clear()
      reload.mockReset()
      vi.spyOn(console, "error").mockImplementation(() => undefined)
      vi.stubGlobal("location", { ...window.location, reload })
      // A page from an earlier deploy calling an action this build doesn't have.
      loadFeedBatch.mockRejectedValue(new Error("Failed to find Server Action"))
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it("stops paging and reloads once, instead of retrying on every scroll", async () => {
      render(<FeedShell initialItems={items(1, 2)} initialNextCursor={2} />)

      await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
      // The effect re-runs once the failure clears the cursor, and doesn't ask again.
      expect(loadFeedBatch).toHaveBeenCalledOnce()
    })

    it("doesn't reload a second time in the same tab", async () => {
      sessionStorage.setItem("feed:reloaded-after-load-failure", "1")

      render(<FeedShell initialItems={items(1, 2)} initialNextCursor={2} />)

      await vi.waitFor(() => expect(console.error).toHaveBeenCalled())
      expect(reload).not.toHaveBeenCalled()
    })
  })

  it("doesn't ask for more once the feed has run out", () => {
    render(<FeedShell initialItems={items(1)} initialNextCursor={null} />)
    expect(loadFeedBatch).not.toHaveBeenCalled()
  })

  it("pauses and resumes auto-play with the space bar", () => {
    render(<FeedShell initialItems={items(1)} initialNextCursor={null} />)
    const article = () => screen.getByTestId("article")
    expect(article()).toHaveAttribute("data-autoplay", "true")

    fireEvent.keyDown(window, { key: " " })
    expect(article()).toHaveAttribute("data-autoplay", "false")

    fireEvent.keyDown(window, { key: " " })
    expect(article()).toHaveAttribute("data-autoplay", "true")
  })
})
