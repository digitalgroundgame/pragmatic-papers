import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RenderedFeedArticle } from "../types"
import { makeSummary } from "./fixtures"

// The children are covered by their own tests; stub them so these tests see
// only the shell's job: which slots exist, which are mounted, and paging. The
// buttons stand in for what the real children report back to the shell.
vi.mock("../ArticleView", async () => {
  const { useFeedAutoPlay } = await import("../hooks/useFeedAutoPlay")
  return {
    ArticleView: (props: {
      article: RenderedFeedArticle
      active: boolean
      initialPage: number
      autoPlayEnabled: boolean
      onPageChange: (pageIndex: number) => void
      onEndReached: () => void
    }) => {
      const { pauseAutoPlay, resumeAutoPlay } = useFeedAutoPlay()
      const id = props.article.article.id
      return (
        <div
          data-testid="article"
          data-id={id}
          data-active={props.active}
          data-page={props.initialPage}
          data-autoplay={props.autoPlayEnabled}
        >
          <button onClick={() => props.onPageChange(2)}>{`turn ${id} to page 3`}</button>
          <button onClick={props.onEndReached}>{`finish ${id}`}</button>
          <button onClick={pauseAutoPlay}>{`pause from ${id}`}</button>
          <button onClick={resumeAutoPlay}>{`resume from ${id}`}</button>
        </div>
      )
    },
  }
})
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

    it("doesn't reload when session storage is blocked", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError")
      })

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

  describe("tracking the slot on screen", () => {
    // Captures the shell's observer so a test can report what's in view.
    let report: (visible: Array<[idx: number | undefined, ratio: number]>) => void
    beforeEach(() => {
      class CapturingObserver {
        constructor(callback: IntersectionObserverCallback) {
          report = (visible) =>
            act(() =>
              callback(
                visible.map(([idx, ratio]) => {
                  const target = document.createElement("section")
                  if (idx !== undefined) target.dataset.idx = String(idx)
                  return {
                    target,
                    intersectionRatio: ratio,
                  } as unknown as IntersectionObserverEntry
                }),
                this as unknown as IntersectionObserver,
              ),
            )
        }
        observe = vi.fn()
        disconnect = vi.fn()
      }
      vi.stubGlobal("IntersectionObserver", CapturingObserver)
    })
    afterEach(() => vi.unstubAllGlobals())

    const mountedIds = () => screen.getAllByTestId("article").map((el) => el.dataset.id)

    it("makes the mostly-visible slot active and mounts its neighbours", () => {
      render(<FeedShell initialItems={items(1, 2, 3, 4)} initialNextCursor={null} />)

      report([
        [1, 0.3],
        [2, 0.9],
      ])
      expect(mountedIds()).toEqual(["2", "3", "4"])
      expect(screen.getAllByTestId("article")[1]).toHaveAttribute("data-active", "true")
    })

    it("ignores a slot that is only partly in view, or has no index", () => {
      render(<FeedShell initialItems={items(1, 2, 3, 4)} initialNextCursor={null} />)

      report([
        [2, 0.5],
        [undefined, 1],
      ])
      expect(mountedIds()).toEqual(["1", "2"])
    })

    it("keeps the URL on the active article and page, and remembers the page", () => {
      vi.useFakeTimers()
      const replaceState = vi.spyOn(window.history, "replaceState")
      try {
        render(<FeedShell initialItems={items(1, 2, 3)} initialNextCursor={null} />)

        fireEvent.click(screen.getByRole("button", { name: "turn 1 to page 3" }))
        act(() => vi.advanceTimersByTime(300))
        expect(replaceState).toHaveBeenLastCalledWith(null, "", "/feed/articles/article-1?p=2")

        // Moving on drops the page from the URL...
        report([[1, 1]])
        act(() => vi.advanceTimersByTime(300))
        expect(replaceState).toHaveBeenLastCalledWith(null, "", "/feed/articles/article-2")

        // ...and coming back reopens the article where the reader left it.
        report([[0, 1]])
        act(() => vi.advanceTimersByTime(300))
        expect(replaceState).toHaveBeenLastCalledWith(null, "", "/feed/articles/article-1?p=2")
        expect(screen.getAllByTestId("article")[0]).toHaveAttribute("data-page", "2")
      } finally {
        replaceState.mockRestore()
        vi.useRealTimers()
      }
    })

    it("leaves the URL alone on an ad", () => {
      vi.useFakeTimers()
      const replaceState = vi.spyOn(window.history, "replaceState")
      try {
        render(<FeedShell initialItems={items(1, 2, 3, 4, 5, 6)} initialNextCursor={null} />)
        act(() => vi.advanceTimersByTime(300))
        replaceState.mockClear()

        report([[5, 1]]) // the ad after the fifth article
        act(() => vi.advanceTimersByTime(300))
        expect(replaceState).not.toHaveBeenCalled()
        expect(screen.getByTestId("ad")).toBeInTheDocument()
      } finally {
        replaceState.mockRestore()
        vi.useRealTimers()
      }
    })
  })

  describe("moving between slots", () => {
    const scrollBy = vi.fn()
    beforeEach(() => {
      scrollBy.mockReset()
      Object.defineProperty(HTMLElement.prototype, "scrollBy", {
        configurable: true,
        value: scrollBy,
      })
      // jsdom lays nothing out; give the scroller a screen's height.
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800)
    })
    afterEach(() => {
      delete (HTMLElement.prototype as { scrollBy?: unknown }).scrollBy
      vi.restoreAllMocks()
    })

    it("scrolls one slot down or up with the arrow keys", () => {
      render(<FeedShell initialItems={items(1, 2)} initialNextCursor={null} />)

      fireEvent.keyDown(window, { key: "ArrowDown" })
      fireEvent.keyDown(window, { key: "ArrowUp" })
      expect(scrollBy.mock.calls.map(([arg]) => arg.top)).toEqual([800, -800])
    })

    it("leaves keys alone while the reader is typing", () => {
      render(
        <>
          <input aria-label="Email" />
          <FeedShell initialItems={items(1)} initialNextCursor={null} />
        </>,
      )
      const input = screen.getByRole("textbox", { name: "Email" })

      fireEvent.keyDown(input, { key: "ArrowDown" })
      fireEvent.keyDown(input, { key: " " })
      expect(scrollBy).not.toHaveBeenCalled()
      expect(screen.getByTestId("article")).toHaveAttribute("data-autoplay", "true")
    })

    it("scrolls to the next slot when an article finishes", () => {
      render(<FeedShell initialItems={items(1, 2)} initialNextCursor={null} />)
      fireEvent.click(screen.getByRole("button", { name: "finish 1" }))
      expect(scrollBy).toHaveBeenCalledOnce()
    })
  })

  it("holds auto-play while any child asks it to pause", () => {
    render(<FeedShell initialItems={items(1)} initialNextCursor={null} />)
    const article = () => screen.getByTestId("article")

    fireEvent.click(screen.getByRole("button", { name: "pause from 1" }))
    fireEvent.click(screen.getByRole("button", { name: "pause from 1" }))
    fireEvent.click(screen.getByRole("button", { name: "resume from 1" }))
    expect(article()).toHaveAttribute("data-autoplay", "false")

    fireEvent.click(screen.getByRole("button", { name: "resume from 1" }))
    expect(article()).toHaveAttribute("data-autoplay", "true")

    // An extra resume can't push the count below zero.
    fireEvent.click(screen.getByRole("button", { name: "resume from 1" }))
    fireEvent.click(screen.getByRole("button", { name: "pause from 1" }))
    expect(article()).toHaveAttribute("data-autoplay", "false")
  })
})
