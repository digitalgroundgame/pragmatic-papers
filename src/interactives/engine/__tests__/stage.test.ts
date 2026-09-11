import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MapStage, ZOOM_STEP, type StageCallbacks } from "../stage"
import type { DrilldownAsset, RegionIndex, SeatBlockConfig } from "../types"

/**
 * A two-circuit overview, flat (no Y-flip) so `buildMorphPairs`' flip check
 * (`stage.ts`'s `buildMorphPlan`) always declines and every drill takes the deterministic
 * crossfade fallback rather than the RAF-driven vertex morph — the morph's own math is
 * covered in `morph.test.ts`; this file is about the stage that drives it.
 */
const WEST_D = "M0 0 L60 0 L60 60 L0 60 Z"
const EAST_D = "M60 0 L120 0 L120 60 L60 60 Z"

const overviewMarkup = `
  <svg data-drilldown-overview="" viewBox="0 0 120 60">
    <g data-drilldown-shapes="">
      <path data-region-id="west" data-role="parent" data-layer="circuit" tabindex="0" d="${WEST_D}"></path>
      <path data-region-id="east" data-role="parent" data-layer="circuit" tabindex="0" d="${EAST_D}"></path>
      <path data-role="outline" data-outline-for="west" d="${WEST_D}"></path>
      <path data-role="outline" data-outline-for="east" d="${EAST_D}"></path>
    </g>
    <g data-drilldown-annotations=""></g>
  </svg>
`

function region(
  over: Partial<RegionIndex["byId"][string]> & { id: string },
): RegionIndex["byId"][string] {
  return {
    label: over.id,
    parentId: null,
    inset: false,
    hasGeometry: false,
    layer: null,
    facts: {},
    summary: null,
    notes: [],
    childrenLabel: null,
    order: null,
    heading: null,
    ...over,
  }
}

const regions: RegionIndex = {
  byId: {
    west: region({
      id: "west",
      label: "West",
      hasGeometry: true,
      layer: "circuit",
      facts: { seats: "3", "seats-d": "2" },
    }),
    east: region({
      id: "east",
      label: "East",
      hasGeometry: true,
      layer: "circuit",
      facts: { seats: "1" },
    }),
    // No path in the overview at all: read only through its seat block, like SCOTUS.
    scotus: region({ id: "scotus", label: "Supreme Court", facts: { seats: "2" } }),
  },
  topLevel: ["west", "east", "scotus"],
  childrenOf: {},
}

const seats: SeatBlockConfig = {
  totalFact: "seats",
  groups: [{ fact: "seats-d", label: "D", color: "blue" }],
  // scotus draws no shape of its own, so its block needs a declared place to sit — exactly
  // what a real profile does for a court with no territory on the map.
  anchors: { scotus: [20, 20] },
}

const westAsset: DrilldownAsset = {
  viewBox: [0, 0, 60, 60],
  flipY: false,
  paths: [
    {
      id: "west",
      d: WEST_D,
      layer: "circuit",
      parentId: null,
      inset: false,
      label: "West",
      facts: {},
    },
  ],
  payload: null,
  payloadError: null,
}

const noGeometryAsset: DrilldownAsset = {
  viewBox: null,
  flipY: false,
  paths: [],
  payload: null,
  payloadError: null,
}

function setSize(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true })
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true })
}

function callbacks(): StageCallbacks & Record<keyof StageCallbacks, ReturnType<typeof vi.fn>> {
  return {
    onHover: vi.fn(),
    onSelect: vi.fn(),
    onAnchorMoved: vi.fn(),
    onRegionMoved: vi.fn(),
    onLayoutReset: vi.fn(),
    onCamera: vi.fn(),
  } as unknown as StageCallbacks & Record<keyof StageCallbacks, ReturnType<typeof vi.fn>>
}

function makeStage(cbs = callbacks()) {
  const viewport = document.createElement("div")
  setSize(viewport, 900, 600)
  const overviewLayer = document.createElement("div")
  overviewLayer.innerHTML = overviewMarkup
  const layersHost = document.createElement("div")
  document.body.append(viewport, overviewLayer, layersHost)
  const stage = new MapStage({
    viewport,
    overviewLayer,
    layersHost,
    overviewViewBox: [0, 0, 120, 60],
    flipY: false,
    regions,
    seats,
    callbacks: cbs,
  })
  const svg = overviewLayer.querySelector("svg[data-drilldown-overview]") as SVGSVGElement
  const west = svg.querySelector('path[data-region-id="west"]') as SVGPathElement
  const east = svg.querySelector('path[data-region-id="east"]') as SVGPathElement
  return { stage, svg, west, east, viewport, overviewLayer, layersHost, cbs }
}

function pointer(type: string, opts: Partial<PointerEventInit> = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    button: 0,
    ...opts,
  })
}

describe("MapStage construction", () => {
  it("throws when the overview layer has no server-rendered overview svg", () => {
    const viewport = document.createElement("div")
    const overviewLayer = document.createElement("div")
    const layersHost = document.createElement("div")
    expect(
      () =>
        new MapStage({
          viewport,
          overviewLayer,
          layersHost,
          overviewViewBox: [0, 0, 10, 10],
          flipY: false,
          regions,
          seats: null,
          callbacks: callbacks(),
        }),
    ).toThrow(/has no svg/)
  })

  it("throws when the overview svg is missing its shapes or annotations group", () => {
    const viewport = document.createElement("div")
    const overviewLayer = document.createElement("div")
    overviewLayer.innerHTML = `<svg data-drilldown-overview="" viewBox="0 0 1 1"></svg>`
    const layersHost = document.createElement("div")
    expect(
      () =>
        new MapStage({
          viewport,
          overviewLayer,
          layersHost,
          overviewViewBox: [0, 0, 1, 1],
          flipY: false,
          regions,
          seats: null,
          callbacks: callbacks(),
        }),
    ).toThrow(/missing its groups/)
  })

  it("marks every targetable path a button, and leaves everything else alone", () => {
    const { svg, west } = makeStage()
    expect(west).toHaveAttribute("role", "button")
    expect(svg.querySelector('path[data-role="outline"]')).not.toHaveAttribute("role")
  })
})

describe("setSelected", () => {
  it("marks the chosen region selected and shows its outline, and clears on null", () => {
    const { stage, svg, west, east } = makeStage()
    stage.setSelected("west")
    expect(west).toHaveAttribute("data-selected", "")
    expect(east).not.toHaveAttribute("data-selected")
    const overlay = svg.querySelector('path[data-drilldown-overlay="selected"]')!
    expect(overlay).toHaveAttribute("data-visible", "")
    expect(overlay.getAttribute("d")).toContain("M0")

    stage.setSelected(null)
    expect(west).not.toHaveAttribute("data-selected")
    expect(overlay).not.toHaveAttribute("data-visible")
  })
})

describe("renderBlocks", () => {
  it("draws one block per requested region, with a vacancy where the group falls short", () => {
    const { stage, svg } = makeStage()
    stage.renderBlocks(["west", "east"])
    const west = svg.querySelector('g[data-drilldown-block][data-region-id="west"]')!
    expect(west.querySelectorAll('rect[data-block-seat="filled"]')).toHaveLength(2)
    expect(west.querySelectorAll('rect[data-block-seat="vacant"]')).toHaveLength(1)
    expect(svg.querySelector('g[data-drilldown-block][data-region-id="east"]')).toBeInTheDocument()
  })

  it("gives a region with no shape on this map a plinth to sit on", () => {
    const { stage, svg } = makeStage()
    stage.renderBlocks(["scotus"])
    const block = svg.querySelector('g[data-drilldown-block][data-region-id="scotus"]')!
    expect(block.querySelector("rect[data-block-plinth]")).toBeInTheDocument()
    // A region that does draw its own shape gets no plinth — the map itself is its ground.
    stage.renderBlocks(["west"])
    expect(
      svg.querySelector('g[data-drilldown-block][data-region-id="west"] rect[data-block-plinth]'),
    ).not.toBeInTheDocument()
  })

  it("removes the blocks group instead of drawing an empty one", () => {
    const { stage, svg } = makeStage()
    stage.renderBlocks(["west"])
    expect(svg.querySelector("g[data-drilldown-blocks]")).toBeInTheDocument()
    stage.renderBlocks([])
    expect(svg.querySelector("g[data-drilldown-blocks]")).not.toBeInTheDocument()
  })

  it("reuses the same nodes when nothing that decides their look changed, and rebuilds when the zoom does", () => {
    const { stage, svg } = makeStage()
    stage.renderBlocks(["west", "east"])
    const first = svg.querySelector('g[data-drilldown-block][data-region-id="west"]')
    stage.renderBlocks(["west", "east"])
    expect(svg.querySelector('g[data-drilldown-block][data-region-id="west"]')).toBe(first)
    stage.zoomBy(ZOOM_STEP)
    stage.renderBlocks(["west", "east"])
    expect(svg.querySelector('g[data-drilldown-block][data-region-id="west"]')).not.toBe(first)
  })
})

describe("camera", () => {
  let ctx: ReturnType<typeof makeStage>

  beforeEach(() => {
    ctx = makeStage()
  })

  it("starts at rest, and zooming in moves it and tells the callback", () => {
    const { stage, viewport, cbs } = ctx
    expect(stage.zoom).toBe(1)
    stage.zoomBy(ZOOM_STEP)
    expect(stage.zoom).toBeCloseTo(ZOOM_STEP)
    expect(viewport).toHaveAttribute("data-zoomed", "")
    expect(cbs.onCamera).toHaveBeenCalledWith(stage.zoom)
  })

  it("resetCamera puts the whole map back and drops the zoomed flag", () => {
    const { stage, viewport } = ctx
    stage.zoomBy(ZOOM_STEP)
    stage.resetCamera()
    expect(stage.zoom).toBe(1)
    expect(viewport).not.toHaveAttribute("data-zoomed")
  })

  it("panBy does nothing at rest, and moves the frame once zoomed in", () => {
    const { stage, svg } = ctx
    const atRest = svg.getAttribute("viewBox")
    stage.panBy(50, 0)
    expect(svg.getAttribute("viewBox")).toBe(atRest)

    stage.zoomBy(ZOOM_STEP)
    const zoomed = svg.getAttribute("viewBox")
    stage.panBy(50, 0)
    expect(svg.getAttribute("viewBox")).not.toBe(zoomed)
  })

  it("clearSentCamera takes back a camera the map sent, and leaves one the reader drove", () => {
    const { stage } = ctx
    // Auto: reduced motion makes `flyCamera` land in one step, so `focusOn` is synchronous.
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList)
    stage.renderBlocks(["east"])
    stage.focusOn("east")
    expect(stage.zoom).toBeGreaterThan(1)
    stage.clearSentCamera()
    expect(stage.zoom).toBe(1)

    stage.zoomBy(ZOOM_STEP) // driven, not sent
    stage.clearSentCamera()
    expect(stage.zoom).toBeGreaterThan(1)
  })

  it("focusOn a region with no shape on this map still finds its seat block", () => {
    const { stage } = ctx
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList)
    stage.renderBlocks(["scotus"])
    stage.focusOn("scotus")
    expect(stage.zoom).toBeGreaterThan(1)
  })

  it("focusOn a region with no block anywhere does nothing", () => {
    const { stage } = ctx
    stage.focusOn("nowhere")
    expect(stage.zoom).toBe(1)
  })
})

describe("pointer interaction", () => {
  let ctx: ReturnType<typeof makeStage>

  beforeEach(() => {
    ctx = makeStage()
  })

  it("lights a region the instant a pointer first lands on it", () => {
    const { west, cbs } = ctx
    west.dispatchEvent(pointer("pointerover", { clientX: 1, clientY: 2 }))
    expect(cbs.onHover).toHaveBeenCalledWith("west", { x: 1, y: 2 })
  })

  it("forgives a border crossing that resolves back to the same region", () => {
    vi.useFakeTimers()
    try {
      const { west, east, cbs } = ctx
      west.dispatchEvent(pointer("pointerover"))
      cbs.onHover.mockClear()
      east.dispatchEvent(pointer("pointerover"))
      west.dispatchEvent(pointer("pointerover")) // back before the delay elapses
      vi.advanceTimersByTime(200)
      expect(cbs.onHover).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("commits a hover change once it has held for its forgiveness window", () => {
    vi.useFakeTimers()
    try {
      const { west, east, cbs } = ctx
      west.dispatchEvent(pointer("pointerover"))
      cbs.onHover.mockClear()
      east.dispatchEvent(pointer("pointerover"))
      vi.advanceTimersByTime(200)
      expect(cbs.onHover).toHaveBeenCalledWith("east", expect.any(Object))
    } finally {
      vi.useRealTimers()
    }
  })

  it("clears the hover as soon as the pointer leaves the map outright — unambiguous, no grace period", () => {
    const { svg, west, cbs } = ctx
    west.dispatchEvent(pointer("pointerover"))
    cbs.onHover.mockClear()
    svg.dispatchEvent(pointer("pointerleave"))
    expect(cbs.onHover).toHaveBeenCalledWith(null, null)
  })

  it("selects on click, and tells the caller whether it was a click or a keyboard activation", () => {
    const { west, cbs } = ctx
    west.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    expect(cbs.onSelect).toHaveBeenCalledWith("west", "pointer")
    cbs.onSelect.mockClear()
    west.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
    expect(cbs.onSelect).toHaveBeenCalledWith("west", "keyboard")
  })

  it("selects on Enter or Space, and ignores every other key", () => {
    const { west, cbs } = ctx
    const enter = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" })
    const preventDefault = vi.spyOn(enter, "preventDefault")
    west.dispatchEvent(enter)
    expect(cbs.onSelect).toHaveBeenCalledWith("west", "keyboard")
    expect(preventDefault).toHaveBeenCalled()

    cbs.onSelect.mockClear()
    west.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }))
    expect(cbs.onSelect).not.toHaveBeenCalled()
  })

  it("hovers a focused region, and clears it once focus leaves", () => {
    const { west, cbs } = ctx
    west.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    expect(cbs.onHover).toHaveBeenCalledWith("west", expect.any(Object))
    cbs.onHover.mockClear()
    west.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
    expect(cbs.onHover).toHaveBeenCalledWith(null, null)
  })

  it("suppresses the click a pan gesture would otherwise have ended in", async () => {
    const { stage, svg, west, cbs } = ctx
    stage.zoomBy(ZOOM_STEP) // panning needs something to pan around in
    svg.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    window.dispatchEvent(pointer("pointermove", { clientX: 40, clientY: 0 }))
    window.dispatchEvent(pointer("pointerup", { clientX: 40, clientY: 0 }))
    west.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    expect(cbs.onSelect).not.toHaveBeenCalled()
    // The suppression is one turn of the event loop, not longer.
    await new Promise((r) => setTimeout(r, 0))
    west.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    expect(cbs.onSelect).toHaveBeenCalledWith("west", "pointer")
  })

  it("a press that never crosses the pan threshold still selects normally", () => {
    const { stage, svg, west, cbs } = ctx
    stage.zoomBy(ZOOM_STEP)
    svg.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    window.dispatchEvent(pointer("pointermove", { clientX: 1, clientY: 0 }))
    window.dispatchEvent(pointer("pointerup", { clientX: 1, clientY: 0 }))
    west.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    expect(cbs.onSelect).toHaveBeenCalledWith("west", "pointer")
  })

  it("does not pan at rest — a plain click still selects", () => {
    const { stage, svg, west, cbs } = ctx
    expect(stage.zoom).toBe(1)
    svg.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    window.dispatchEvent(pointer("pointermove", { clientX: 40, clientY: 0 }))
    window.dispatchEvent(pointer("pointerup", { clientX: 40, clientY: 0 }))
    west.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    expect(cbs.onSelect).toHaveBeenCalledWith("west", "pointer")
  })
})

describe("wheel zoom", () => {
  let ctx: ReturnType<typeof makeStage>

  beforeEach(() => {
    ctx = makeStage()
  })

  const wheel = (deltaY: number, extra: Partial<WheelEventInit> = {}): WheelEvent =>
    new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY, ...extra })

  it("zooms in on a negative delta and prevents the page from scrolling", () => {
    const { stage, svg } = ctx
    const e = wheel(-200)
    svg.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(stage.zoom).toBeGreaterThan(1)
  })

  it("hands scrolling back to the page at either end of the range", () => {
    const { stage, svg } = ctx
    const outAtRest = wheel(200)
    svg.dispatchEvent(outAtRest)
    expect(outAtRest.defaultPrevented).toBe(false)
    expect(stage.zoom).toBe(1)
  })

  it("a pinch is always taken, even past the ordinary limit", () => {
    const { svg } = ctx
    const e = wheel(200, { ctrlKey: true })
    svg.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })

  it("does nothing while the reader is only scrolling past the map", () => {
    const { stage, svg } = ctx
    svg.dispatchEvent(wheel(0))
    expect(stage.zoom).toBe(1)
  })

  it("is off while an editor is dragging the map's furniture", () => {
    const { stage, svg } = ctx
    stage.setLayoutEditing(true)
    const e = wheel(-200)
    svg.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
    expect(stage.zoom).toBe(1)
  })
})

describe("layout editing", () => {
  let ctx: ReturnType<typeof makeStage>

  beforeEach(() => {
    ctx = makeStage()
    ctx.stage.setLayoutEditing(true)
  })

  it("flags every layer's annotations while it is on, and clears them when it is off", () => {
    const { stage, svg } = ctx
    expect(svg.querySelector("g[data-drilldown-annotations]")).toHaveAttribute(
      "data-drilldown-layout-editing",
      "",
    )
    stage.setLayoutEditing(false)
    expect(svg.querySelector("g[data-drilldown-annotations]")).not.toHaveAttribute(
      "data-drilldown-layout-editing",
    )
  })

  it("nudges a region's shapes, prints the offset, and a second press puts it back", () => {
    const { stage, svg, west, cbs } = ctx
    west.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    svg.dispatchEvent(pointer("pointermove", { clientX: 10, clientY: 0 }))
    svg.dispatchEvent(pointer("pointerup", { clientX: 10, clientY: 0 }))
    expect(cbs.onRegionMoved).toHaveBeenCalledWith("west", [expect.any(Number), 0], {
      layer: "overview",
      writable: true,
    })
    expect(west.getAttribute("transform")).toMatch(/translate/)
    expect(stage.movedRegionsJSON()).not.toBe("{}")

    west.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    expect(cbs.onLayoutReset).toHaveBeenCalledWith("west", { layer: "overview", writable: true })
    expect(west).not.toHaveAttribute("transform")
    expect(stage.movedRegionsJSON()).toBe("{}")
  })

  it("drags a seat block's anchor, and a second press resets it", () => {
    const { stage, svg, cbs } = ctx
    stage.renderBlocks(["west"])
    const block = svg.querySelector('g[data-drilldown-block][data-region-id="west"]')!
    block.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    svg.dispatchEvent(pointer("pointermove", { clientX: 5, clientY: 5 }))
    svg.dispatchEvent(pointer("pointerup", { clientX: 5, clientY: 5 }))
    expect(cbs.onAnchorMoved).toHaveBeenCalledWith(
      "west",
      [expect.any(Number), expect.any(Number)],
      { layer: "overview", writable: true },
    )
    expect(stage.movedAnchorsJSON()).not.toBe("{}")

    // A fresh block element after the redraw — press it, not the one that was replaced.
    const rebuilt = svg.querySelector('g[data-drilldown-block][data-region-id="west"]')!
    rebuilt.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    expect(cbs.onLayoutReset).toHaveBeenCalledWith("west", { layer: "overview", writable: true })
    expect(stage.movedAnchorsJSON()).toBe("{}")
  })

  it("clears every moved anchor and shape when editing turns off", () => {
    const { stage, svg, west } = ctx
    west.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    svg.dispatchEvent(pointer("pointermove", { clientX: 10, clientY: 0 }))
    svg.dispatchEvent(pointer("pointerup", { clientX: 10, clientY: 0 }))
    stage.setLayoutEditing(false)
    expect(stage.movedRegionsJSON()).toBe("{}")
    expect(west).not.toHaveAttribute("transform")
  })

  it("carries a nudged shape's offset into its own hover outline", () => {
    const { svg, west } = ctx
    west.dispatchEvent(pointer("pointerover"))
    const overlay = svg.querySelector('path[data-drilldown-overlay=""]')!
    const before = overlay.getAttribute("d")

    // The drag's own `move` handler keeps the mark in step — it is still on `west`, which
    // stays hovered throughout, so nothing re-requests the hover to make that happen.
    west.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    svg.dispatchEvent(pointer("pointermove", { clientX: 10, clientY: 0 }))
    expect(overlay.getAttribute("d")).not.toBe(before)
  })

  it("does not pan the map while editing is on", () => {
    const { stage, svg } = ctx
    stage.zoomBy(ZOOM_STEP)
    const before = svg.getAttribute("viewBox")
    svg.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }))
    window.dispatchEvent(pointer("pointermove", { clientX: 40, clientY: 0 }))
    window.dispatchEvent(pointer("pointerup", { clientX: 40, clientY: 0 }))
    // The drag above landed on the map itself (not a region path or a block), so nothing
    // should have moved it: onRegionDown bails out for a target with no region id.
    expect(svg.getAttribute("viewBox")).toBe(before)
  })
})

describe("drilling in and out", () => {
  let ctx: ReturnType<typeof makeStage>

  beforeEach(() => {
    ctx = makeStage()
  })

  it("hasGeometry is false for an asset with no id'd paths", () => {
    const { stage } = ctx
    expect(stage.hasGeometry(noGeometryAsset)).toBe(false)
    expect(stage.hasGeometry(westAsset)).toBe(true)
  })

  it("a region with no map of its own stays on the overview, reported as no-geometry", async () => {
    const { stage } = ctx
    await expect(stage.drillIn("scotus", noGeometryAsset)).resolves.toBe("no-geometry")
    expect(stage.currentParent).toBe("scotus")
    expect(stage.zoom).toBe(1) // the camera was put back
  })

  it("falls back to a crossfade when there is no vertex correspondence to morph", async () => {
    const { stage, overviewLayer, layersHost } = ctx
    const outcome = await stage.drillIn("west", westAsset)
    expect(outcome).toBe("fallback")
    expect(stage.currentParent).toBe("west")
    expect(overviewLayer).toHaveAttribute("data-state", "fade-out")
    const local = layersHost.querySelector('[data-parent-id="west"]')!
    expect(local.getAttribute("data-state")).toMatch(/fad/)
  })

  it("drilling back out returns the overview to view", async () => {
    const { stage, overviewLayer } = ctx
    await stage.drillIn("west", westAsset)
    const outcome = await stage.drillOut()
    expect(outcome).toBe("fallback")
    expect(stage.currentParent).toBeNull()
    expect(overviewLayer).toHaveAttribute("data-state", "visible")
  })

  it("crossing with nothing drilled into yet is an ordinary drill-in", async () => {
    const { stage } = ctx
    await expect(stage.crossTo("west", westAsset)).resolves.toBe("fallback")
    expect(stage.currentParent).toBe("west")
  })

  it("crossing between two maps with no morph plan still lands on the destination", async () => {
    const { stage } = ctx
    const eastAsset: DrilldownAsset = {
      ...westAsset,
      viewBox: [0, 0, 60, 60],
      paths: [{ ...westAsset.paths[0]!, id: "east" }],
    }
    await stage.drillIn("west", westAsset)
    await expect(stage.crossTo("east", eastAsset)).resolves.toBe("fallback")
    expect(stage.currentParent).toBe("east")
  })

  it("builds a child map's own roles: its boundary, its children, decoration and an outline clone", async () => {
    const { stage, layersHost } = ctx
    const withChildren: DrilldownAsset = {
      viewBox: [0, 0, 60, 60],
      flipY: false,
      paths: [
        {
          id: "west",
          d: WEST_D,
          layer: "circuit",
          parentId: null,
          inset: false,
          label: null,
          facts: {},
        },
        {
          id: "w1",
          d: "M0 0 L30 0 L30 60 L0 60 Z",
          layer: "district",
          parentId: "west",
          inset: false,
          label: null,
          facts: {},
        },
        {
          id: null,
          d: "M5 5 L10 5 L10 10 L5 10 Z",
          layer: null,
          parentId: null,
          inset: false,
          label: null,
          facts: {},
        },
      ],
      payload: null,
      payloadError: null,
    }
    await stage.drillIn("west", withChildren)
    const local = layersHost.querySelector('[data-parent-id="west"]')!
    expect(
      local.querySelector('path[data-region-id="west"][data-role="parent"]'),
    ).toBeInTheDocument()
    const child = local.querySelector('path[data-region-id="w1"][data-role="child"]')!
    expect(child).toHaveAttribute("data-parent-id", "west")
    expect(child).toHaveAttribute("tabindex", "0")
    expect(child).toHaveAttribute("aria-label", "w1") // no region info registered for it here
    expect(local.querySelector('path[data-role="decorative"]')).toBeInTheDocument()
    expect(
      local.querySelector('path[data-role="outline"][data-outline-for="west"]'),
    ).toBeInTheDocument()
  })

  it("returns cancelled once the stage has been destroyed", async () => {
    const { stage } = ctx
    stage.destroy()
    await expect(stage.drillIn("west", westAsset)).resolves.toBe("cancelled")
  })
})

describe("destroy", () => {
  it("puts the overview back exactly as React rendered it", () => {
    const { stage, svg, west } = makeStage()
    stage.setSelected("west")
    west.dispatchEvent(pointer("pointerover"))
    stage.destroy()
    expect(svg.querySelector('path[data-drilldown-overlay=""]')).not.toBeInTheDocument()
    expect(svg.querySelector('path[data-drilldown-overlay="selected"]')).not.toBeInTheDocument()
    expect(west).not.toHaveAttribute("data-selected")
    expect(west).not.toHaveAttribute("role")
    expect(svg).not.toHaveAttribute("data-state")
  })
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
