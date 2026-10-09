import { act, cleanup, render, renderHook } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { FRESH, Fresh, useFresh } from ".."
import { resetSeenStore, SEEN_KEY_PREFIX } from "../store"

const NAME = FRESH.modeToggle

beforeEach(() => {
  localStorage.clear()
  resetSeenStore()
})

afterEach(cleanup)

describe("Fresh", () => {
  it("renders a decorative dot in the top-right corner until it is seen", () => {
    const { container } = render(<Fresh name={NAME} />)

    const dot = container.firstElementChild
    expect(dot).toHaveAttribute("aria-hidden", "true")
    expect(dot).toHaveAttribute("data-slot", "fresh")
    expect(dot).toHaveClass("absolute", "top-0.5", "right-0.5", "rounded-full")
  })

  it("renders nothing once seen", () => {
    localStorage.setItem(`${SEEN_KEY_PREFIX}${NAME}`, "1")

    const { container } = render(<Fresh name={NAME} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("lets the caller reposition it", () => {
    const { container } = render(<Fresh name={NAME} className="top-0 right-0" />)

    expect(container.firstElementChild).toHaveClass("top-0", "right-0")
    expect(container.firstElementChild).not.toHaveClass("top-0.5")
  })
})

describe("useFresh", () => {
  function renderDot(className?: string): {
    container: HTMLElement
    markSeen: (open?: unknown) => void
  } {
    const { result } = renderHook(() => useFresh(NAME, { className }))
    const { container } = render(<>{result.current.freshDot}</>)
    return { container, markSeen: result.current.markSeen }
  }

  it("returns the fresh dot, positioned by the caller", () => {
    const { container } = renderDot("top-0 right-0")

    expect(container.firstElementChild).toHaveAttribute("data-slot", "fresh")
    expect(container.firstElementChild).toHaveClass("top-0", "right-0")
  })

  it.each([
    ["called bare", undefined],
    ["an onOpenChange opening", true],
    ["an onClick event", new MouseEvent("click")],
  ])("clears the dot when %s", (_, arg) => {
    const { container, markSeen } = renderDot()

    act(() => markSeen(arg))

    expect(container).toBeEmptyDOMElement()
    expect(localStorage.getItem(`${SEEN_KEY_PREFIX}${NAME}`)).toBe("1")
  })

  it("leaves the dot when an onOpenChange closes", () => {
    const { container, markSeen } = renderDot()

    act(() => markSeen(false))

    expect(container.firstElementChild).toHaveAttribute("data-slot", "fresh")
  })
})
