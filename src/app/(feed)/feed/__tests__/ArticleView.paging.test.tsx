import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RenderedFeedArticle } from "../types"
import { makeSummary } from "./fixtures"

// jsdom has no layout, so the real Embla snaps to page 0 whatever it's told.
// A fake carousel lets these tests drive the paging logic ArticleView owns.
const { embla } = vi.hoisted(() => {
  const handlers: Record<string, () => void> = {}
  return {
    embla: {
      handlers,
      canScrollNext: vi.fn(() => true),
      scrollNext: vi.fn(),
      scrollPrev: vi.fn(),
      scrollTo: vi.fn(),
      selectedScrollSnap: vi.fn(() => 0),
      on: vi.fn((event: string, cb: () => void) => {
        handlers[event] = cb
      }),
      off: vi.fn(),
      reInit: vi.fn(),
    },
  }
})
vi.mock("embla-carousel-react", () => ({ default: () => [() => undefined, embla] }))
vi.mock("@/components/Media", async () => (await import("./mediaStub")).mediaStub)

const { ArticleView } = await import("../ArticleView")

function rendered(pageCount: number): RenderedFeedArticle {
  return {
    article: makeSummary({ title: "Turnout" }),
    pages: [
      { kind: "hero", durationMs: 1000 },
      ...Array.from({ length: pageCount - 1 }, () => ({
        kind: "content" as const,
        durationMs: 1000,
      })),
    ],
    bodies: [null, ...Array.from({ length: pageCount - 1 }, (_, i) => <p key={i}>Body {i + 1}</p>)],
  }
}

function renderView(props: Partial<React.ComponentProps<typeof ArticleView>> = {}) {
  const handlers = { onAutoPlayToggle: vi.fn(), onPageChange: vi.fn(), onEndReached: vi.fn() }
  const view = render(
    <ArticleView
      article={rendered(3)}
      active
      initialPage={0}
      autoPlayEnabled={false}
      userAutoPlayEnabled
      {...handlers}
      {...props}
    />,
  )
  return { ...handlers, ...view }
}

function swipe(el: Element, fromX: number, toX: number): void {
  fireEvent.pointerDown(el, { clientX: fromX, clientY: 100 })
  fireEvent.pointerUp(el, { clientX: toX, clientY: 100 })
}

describe("ArticleView paging", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
        "setTimeout",
        "Date",
      ],
    })
    for (const fn of [
      embla.canScrollNext,
      embla.scrollNext,
      embla.scrollPrev,
      embla.scrollTo,
      embla.selectedScrollSnap,
      embla.reInit,
    ]) {
      fn.mockClear()
    }
    embla.canScrollNext.mockReturnValue(true)
    embla.selectedScrollSnap.mockReturnValue(0)
  })
  afterEach(() => vi.useRealTimers())

  it("reports the page the carousel lands on", () => {
    const { onPageChange } = renderView()
    embla.selectedScrollSnap.mockReturnValue(2)
    act(() => embla.handlers.select?.())

    expect(onPageChange).toHaveBeenLastCalledWith(2)
    expect(screen.getByRole("tab", { name: "Go to page 3 of 3" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("reopens on the remembered page, clamped to the article's length", () => {
    renderView({ initialPage: 9 })
    expect(embla.scrollTo).toHaveBeenCalledWith(2, true)
  })

  it("jumps to a page from its progress segment", () => {
    renderView()
    fireEvent.click(screen.getByRole("tab", { name: "Go to page 2 of 3" }))
    expect(embla.scrollTo).toHaveBeenCalledWith(1)
  })

  it("pages with ← and → while the article is active", () => {
    const { rerender } = renderView()
    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(embla.scrollNext).toHaveBeenCalledOnce()
    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(embla.scrollPrev).toHaveBeenCalledOnce()

    rerender(
      <ArticleView
        article={rendered(3)}
        active={false}
        initialPage={0}
        autoPlayEnabled={false}
        userAutoPlayEnabled
        onAutoPlayToggle={vi.fn()}
        onPageChange={vi.fn()}
        onEndReached={vi.fn()}
      />,
    )
    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(embla.scrollNext).toHaveBeenCalledOnce()
  })

  it("leaves arrow keys on a progress segment to the progress bar", () => {
    renderView()
    fireEvent.keyDown(screen.getByRole("tab", { name: "Go to page 1 of 3" }), {
      key: "ArrowRight",
    })
    // The segment moved the page once; the window shortcut didn't move it again.
    expect(embla.scrollTo).toHaveBeenCalledWith(1)
    expect(embla.scrollNext).not.toHaveBeenCalled()
  })

  it("lets only the active article be dragged", () => {
    const { rerender } = renderView()
    expect(embla.reInit).toHaveBeenLastCalledWith({ watchDrag: true })

    rerender(
      <ArticleView
        article={rendered(3)}
        active={false}
        initialPage={0}
        autoPlayEnabled={false}
        userAutoPlayEnabled
        onAutoPlayToggle={vi.fn()}
        onPageChange={vi.fn()}
        onEndReached={vi.fn()}
      />,
    )
    expect(embla.reInit).toHaveBeenLastCalledWith({ watchDrag: false })
  })

  it("auto-play turns the page, then hands over at the last one", () => {
    const { onEndReached } = renderView({ autoPlayEnabled: true })
    act(() => vi.advanceTimersByTime(1200))
    expect(embla.scrollNext).toHaveBeenCalledOnce()
    expect(onEndReached).not.toHaveBeenCalled()
  })

  it("moves to the next article on auto-play's last page", () => {
    embla.canScrollNext.mockReturnValue(false)
    const { onEndReached } = renderView({ autoPlayEnabled: true })
    act(() => vi.advanceTimersByTime(1200))
    expect(embla.scrollNext).not.toHaveBeenCalled()
    expect(onEndReached).toHaveBeenCalled()
  })

  it("moves to the next article on a forward swipe past the last page", () => {
    embla.canScrollNext.mockReturnValue(false)
    const { onEndReached } = renderView()
    swipe(screen.getByText("Body 1"), 300, 200)
    expect(onEndReached).toHaveBeenCalledOnce()
  })

  it("leaves a forward swipe to the carousel while there are pages left", () => {
    const { onEndReached, onAutoPlayToggle } = renderView()
    swipe(screen.getByText("Body 1"), 300, 200)
    expect(onEndReached).not.toHaveBeenCalled()
    expect(onAutoPlayToggle).not.toHaveBeenCalled()
  })

  it("flashes the play state on a tap, then hides it", () => {
    const { onAutoPlayToggle, container } = renderView()
    const flash = () => container.querySelector('[aria-hidden="true"].z-30')

    swipe(screen.getByText("Body 1"), 50, 50)
    expect(onAutoPlayToggle).toHaveBeenCalledOnce()
    expect(flash()).toHaveClass("opacity-100")

    act(() => vi.advanceTimersByTime(700))
    expect(flash()).toHaveClass("opacity-0")
  })

  it("ignores taps on controls and gestures the browser cancelled", () => {
    const { onAutoPlayToggle } = renderView()
    swipe(screen.getByRole("tab", { name: "Go to page 2 of 3" }), 50, 50)

    const body = screen.getByText("Body 1")
    fireEvent.pointerDown(body, { clientX: 50, clientY: 50 })
    fireEvent.pointerCancel(body)
    fireEvent.pointerUp(body, { clientX: 50, clientY: 50 })

    expect(onAutoPlayToggle).not.toHaveBeenCalled()
  })
})
