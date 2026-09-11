// Register @testing-library/jest-dom's matchers (toBeInTheDocument, toHaveAttribute,
// toHaveClass, ...) on Vitest's `expect`. Harmless for the node-environment
// integration project, which loads this file too but never asserts on DOM nodes.
import "@testing-library/jest-dom/vitest"

// Load .env files
import "dotenv/config"

// Testing Library waits one second by default for `findBy*`/`waitFor`. That is generous for a
// component that settles in a microtask and tight for one that awaits a mocked fetch and an
// animation — under a full parallel suite those occasionally crossed the line and failed a
// test that passes on its own. Three seconds is still well inside Vitest's 5s per-test
// timeout, so a genuine hang still fails as a hang, with the right error.
import { configure } from "@testing-library/dom"

configure({ asyncUtilTimeout: 3_000 })

// jsdom implements none of the layout/viewport observation APIs, but
// embla-carousel (and anything else that measures the viewport) reaches for
// them on mount. Stub inert versions — they never fire, which is all a
// markup-level assertion needs.
const noop = (): void => undefined

if (typeof window !== "undefined") {
  class NoopObserver {
    observe = noop
    unobserve = noop
    disconnect = noop
    takeRecords = () => []
  }

  window.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver
  window.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver

  window.matchMedia ??= (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList

  // jsdom has no pointer-capture implementation at all (not even a stub that throws), and the
  // drilldown stage calls it unconditionally when a drag starts.
  const capture = Element.prototype as unknown as Record<string, unknown>
  capture.setPointerCapture ??= noop
  capture.releasePointerCapture ??= noop
  capture.hasPointerCapture ??= () => false

  // jsdom has no Web Animations API either, and Base UI's ScrollArea polls
  // `Element.getAnimations` to know when its auto-hide scrollbar fade has finished.
  ;(Element.prototype as unknown as Record<string, unknown>).getAnimations ??= () => []
}

/**
 * jsdom has no layout engine, so `SVGGraphicsElement.getBBox` — which the drilldown stage
 * uses to size seat blocks, cut their label plinths and place clusters — does not exist at
 * all. This is not a faithful renderer, only enough geometry for those call sites to see a
 * plausible non-zero box: a rect's own attributes, a path's `d` numbers, a text's declared
 * font-size and length, and a group as the union of its children's boxes.
 */
if (typeof SVGGraphicsElement !== "undefined" && !SVGGraphicsElement.prototype.getBBox) {
  const num = (el: Element, attr: string): number => Number(el.getAttribute(attr)) || 0
  const rect = (x: number, y: number, width: number, height: number): DOMRect =>
    ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }) as DOMRect

  // By tag name, not `instanceof` its specific SVG*Element class: jsdom does not expose every
  // one of those constructors as a global the way it does the shared `SVGGraphicsElement`.
  const bboxOf = (el: Element): DOMRect => {
    if (el.tagName === "rect") {
      return rect(num(el, "x"), num(el, "y"), num(el, "width"), num(el, "height"))
    }
    if (el.tagName === "text") {
      const size = num(el, "font-size") || 10
      const length = (el.textContent ?? "").length
      return rect(num(el, "x"), -size, size * 0.6 * length, size * 1.2)
    }
    if (el.tagName === "path") {
      const points = (el.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
      if (points.length < 2) return rect(0, 0, 0, 0)
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (let i = 0; i + 1 < points.length; i += 2) {
        x0 = Math.min(x0, points[i]!)
        x1 = Math.max(x1, points[i]!)
        y0 = Math.min(y0, points[i + 1]!)
        y1 = Math.max(y1, points[i + 1]!)
      }
      return rect(x0, y0, x1 - x0, y1 - y0)
    }
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const child of Array.from(el.children)) {
      const b = bboxOf(child)
      if (b.width === 0 && b.height === 0) continue
      x0 = Math.min(x0, b.x)
      y0 = Math.min(y0, b.y)
      x1 = Math.max(x1, b.x + b.width)
      y1 = Math.max(y1, b.y + b.height)
    }
    return Number.isFinite(x0) ? rect(x0, y0, x1 - x0, y1 - y0) : rect(0, 0, 0, 0)
  }

  SVGGraphicsElement.prototype.getBBox = function (this: SVGGraphicsElement): DOMRect {
    return bboxOf(this)
  }
}
