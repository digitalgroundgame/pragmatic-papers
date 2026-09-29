import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAutoPlay } from "../hooks/useAutoPlay"
import type { FeedPageMeta } from "../types"

const page: FeedPageMeta = { kind: "content", durationMs: 1000 }

function setup(props: Partial<Parameters<typeof useAutoPlay>[0]> = {}) {
  const onAdvance = vi.fn()
  const hook = renderHook((p: Parameters<typeof useAutoPlay>[0]) => useAutoPlay(p), {
    initialProps: { active: true, enabled: true, page, onAdvance, ...props },
  })
  return { ...hook, onAdvance }
}

describe("useAutoPlay", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("fills over the page's duration, then advances once", () => {
    const { result, onAdvance } = setup()

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.progress).toBeGreaterThan(0.3)
    expect(result.current.progress).toBeLessThan(0.7)
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(700))
    expect(result.current.progress).toBe(1)
    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it("holds still while paused, inactive, or with no page", () => {
    for (const props of [{ enabled: false }, { active: false }, { page: undefined }]) {
      const { result, onAdvance, unmount } = setup(props)
      act(() => vi.advanceTimersByTime(2000))
      expect(result.current.progress).toBe(0)
      expect(onAdvance).not.toHaveBeenCalled()
      unmount()
    }
  })

  it("keeps its place across a pause and restarts on a new page", () => {
    const { result, rerender, onAdvance } = setup()
    act(() => vi.advanceTimersByTime(500))
    const before = result.current.progress

    rerender({ active: true, enabled: false, page, onAdvance })
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.progress).toBeCloseTo(before, 1)

    rerender({ active: true, enabled: true, page: { ...page }, onAdvance })
    expect(result.current.progress).toBe(0)
  })

  it("never runs for readers who prefer reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query }))
    const { result, onAdvance } = setup()
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.progress).toBe(0)
    expect(onAdvance).not.toHaveBeenCalled()
  })
})
