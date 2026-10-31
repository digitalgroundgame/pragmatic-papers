import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { activeLine, findActiveAnchor, useActiveAnchor } from "../useActiveAnchor"

function headingAt(id: string, top: number): HTMLElement {
  const el = document.createElement("h2")
  el.id = id
  el.getBoundingClientRect = () => ({ top }) as DOMRect
  document.body.append(el)
  return el
}

function setTop(el: HTMLElement, top: number) {
  el.getBoundingClientRect = () => ({ top }) as DOMRect
}

describe("activeLine", () => {
  afterEach(() => {
    document.documentElement.style.scrollPaddingTop = ""
  })

  it("follows the html element's scroll padding", () => {
    // Header plus a sticking ticker, plus the gap above the heading
    document.documentElement.style.scrollPaddingTop = "122px"
    expect(activeLine()).toBe(124)
    // The ticker stopped sticking
    document.documentElement.style.scrollPaddingTop = "81px"
    expect(activeLine()).toBe(83)
  })

  it("falls back when the page sets no scroll padding", () => {
    document.documentElement.style.scrollPaddingTop = "auto"
    expect(activeLine()).toBe(82)
  })
})

describe("findActiveAnchor", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("picks the last heading at or above the line", () => {
    const elements = [headingAt("a", -300), headingAt("b", 122.4), headingAt("c", 500)]
    expect(findActiveAnchor(elements, 124)).toBe("b")
  })

  it("returns null above the first heading", () => {
    expect(findActiveAnchor([headingAt("a", 400)], 124)).toBeNull()
  })

  it("doesn't count a heading the ticker still covers as reached", () => {
    // Without the ticker's height, a fixed line would have passed this heading at 110px
    expect(findActiveAnchor([headingAt("a", 110), headingAt("b", 140)], 83)).toBeNull()
  })
})

describe("useActiveAnchor", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0)
      return 1
    })
    document.documentElement.style.scrollPaddingTop = "122px"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
    document.documentElement.style.scrollPaddingTop = ""
  })

  it("lands on the heading a link scrolled to under the ticker", () => {
    const first = headingAt("first", 122)
    const second = headingAt("second", 600)
    const { result } = renderHook(() =>
      useActiveAnchor([{ anchor: "first" }, { anchor: "second" }]),
    )
    expect(result.current).toBe("first")

    setTop(first, -478)
    setTop(second, 122)
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    expect(result.current).toBe("second")
  })

  it("reads the line again when the ticker stops sticking", () => {
    headingAt("first", 100)
    const { result } = renderHook(() => useActiveAnchor([{ anchor: "first" }]))
    expect(result.current).toBe("first")

    document.documentElement.style.scrollPaddingTop = "81px"
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    expect(result.current).toBeNull()
  })

  it("does nothing while the contents are closed", () => {
    headingAt("first", 0)
    const { result } = renderHook(() => useActiveAnchor([{ anchor: "first" }], false))
    expect(result.current).toBeNull()
  })
})
