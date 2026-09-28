import { act, cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { theme, playSegments, lottieProps } = vi.hoisted(() => ({
  theme: { resolvedTheme: "light" as string | undefined },
  playSegments: vi.fn(),
  lottieProps: vi.fn(),
}))

vi.mock("@wrksz/themes/client", () => ({ useTheme: () => theme }))
vi.mock("../wordmark.json", () => ({ default: { name: "wordmark" } }))
vi.mock("../wordmark-inverted.json", () => ({ default: { name: "wordmark-inverted" } }))
// The player itself is lottie's; this stands in for it and hands back a controllable handle.
vi.mock("lottie-react", () => ({
  LottieLight: ({
    lottieRef,
    ...props
  }: {
    lottieRef: React.RefObject<unknown>
    src: { name: string }
  }) => {
    lottieRef.current = { playSegments }
    lottieProps(props)
    return <div data-testid="lottie" data-src={props.src.name} />
  },
}))

import { AnimatedLogo } from "../AnimatedLogo"

/** A matchMedia whose reduced-motion answer can be flipped, notifying its listeners. */
function stubMotion(reduced: boolean): (next: boolean) => void {
  let matches = reduced
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia
  return (next) => {
    matches = next
    listeners.forEach((fn) => fn())
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  theme.resolvedTheme = "light"
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("AnimatedLogo", () => {
  it("draws the full-colour wordmark once, without looping, on a light page", () => {
    stubMotion(false)
    render(<AnimatedLogo />)
    expect(screen.getByTestId("lottie")).toHaveAttribute("data-src", "wordmark")
    expect(lottieProps).toHaveBeenCalledWith(
      expect.objectContaining({ autoplay: true, loop: false, segment: [0, 60] }),
    )
    // The animation is decorative; the name is read from the visually hidden label.
    expect(screen.getByText("The Pragmatic Papers Logo")).toHaveClass("sr-only")
  })

  it("uses the inverted wordmark on a dark page", () => {
    stubMotion(false)
    theme.resolvedTheme = "dark"
    render(<AnimatedLogo />)
    expect(screen.getByTestId("lottie")).toHaveAttribute("data-src", "wordmark-inverted")
  })

  it("stays still for readers who ask for reduced motion", () => {
    stubMotion(true)
    render(<AnimatedLogo />)
    expect(screen.queryByTestId("lottie")).not.toBeInTheDocument()
  })

  it("renders the static logo until the theme is known, so it never flashes the wrong one", () => {
    stubMotion(false)
    theme.resolvedTheme = undefined
    render(<AnimatedLogo />)
    expect(screen.queryByTestId("lottie")).not.toBeInTheDocument()
  })

  it("stops animating when the reader turns on reduced motion", () => {
    const setReduced = stubMotion(false)
    render(<AnimatedLogo />)
    expect(screen.getByTestId("lottie")).toBeInTheDocument()
    act(() => setReduced(true))
    expect(screen.queryByTestId("lottie")).not.toBeInTheDocument()
  })

  it("draws itself again every two minutes, and stops when unmounted", () => {
    vi.useFakeTimers()
    stubMotion(false)
    const { unmount } = render(<AnimatedLogo />)
    expect(playSegments).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(2 * 60 * 1000))
    expect(playSegments).toHaveBeenCalledTimes(1)
    expect(playSegments).toHaveBeenCalledWith([0, 60])
    unmount()
    act(() => vi.advanceTimersByTime(10 * 60 * 1000))
    expect(playSegments).toHaveBeenCalledTimes(1)
  })

  it("never schedules a replay while motion is reduced", () => {
    vi.useFakeTimers()
    stubMotion(true)
    render(<AnimatedLogo />)
    act(() => vi.advanceTimersByTime(10 * 60 * 1000))
    expect(playSegments).not.toHaveBeenCalled()
  })
})
