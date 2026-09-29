import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RenderedFeedArticle } from "../types"
import { makeSummary } from "./fixtures"

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
  const handlers = {
    onAutoPlayToggle: vi.fn(),
    onPageChange: vi.fn(),
    onEndReached: vi.fn(),
  }
  render(
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
  return handlers
}

describe("ArticleView", () => {
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
  })
  afterEach(() => vi.useRealTimers())

  it("lays out the hero and the server-rendered pages, one progress segment each", () => {
    renderView()

    const pages = screen.getAllByRole("group")
    expect(pages).toHaveLength(3)
    expect(pages[0]).toHaveAccessibleName("Page 1 of 3")
    expect(within(pages[0]!).getByRole("heading", { name: "Turnout" })).toBeInTheDocument()
    expect(within(pages[1]!).getByText("Body 1")).toBeInTheDocument()
    expect(within(pages[2]!).getByText("Body 2")).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(3)
  })

  it("moves to the next article when auto-play finishes the last page", () => {
    const { onEndReached } = renderView({ article: rendered(1), autoPlayEnabled: true })
    act(() => vi.advanceTimersByTime(1500))
    expect(onEndReached).toHaveBeenCalled()
  })

  it("toggles auto-play on a tap", () => {
    const { onAutoPlayToggle } = renderView()
    const body = screen.getByText("Body 1")
    fireEvent.pointerDown(body, { clientX: 5, clientY: 5 })
    fireEvent.pointerUp(body, { clientX: 5, clientY: 5 })
    expect(onAutoPlayToggle).toHaveBeenCalledOnce()
  })
})
