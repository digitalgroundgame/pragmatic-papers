import { flipConstant, flipTransform, padViewBox, viewBoxAttr } from "./geometry"
import {
  buildMorphPairs,
  easeInOutCubic,
  largestSubpathCentre,
  lerpInto,
  lerpViewBox,
  MORPH_MIN_COMMIT_MS,
  MORPH_MS,
  type MorphPair,
  type MorphSource,
  serializePath,
} from "./morph"
import type { DrilldownAsset, RegionIndex, SeatBlockConfig, ViewBox } from "./types"

const SVGNS = "http://www.w3.org/2000/svg"

export type LayerState = "visible" | "hidden" | "hidden-hard" | "fade-out" | "fading" | "fade-in"

export interface StageCallbacks {
  onHover(regionId: string | null, point: { x: number; y: number } | null): void
  /** `via` lets the client move keyboard focus into the pane a keyboard selection opened. */
  onSelect(regionId: string, via: "pointer" | "keyboard"): void
}

export interface StageOptions {
  /** The element that sizes the map; layers are letterboxed inside it. */
  viewport: HTMLElement
  /** The server-rendered overview layer (`[data-drilldown-layer="overview"]`). */
  overviewLayer: HTMLElement
  /** Where imperative layers (child views, morph) are appended. */
  layersHost: HTMLElement
  overviewViewBox: ViewBox
  flipY: boolean
  regions: RegionIndex
  seats: SeatBlockConfig | null
  callbacks: StageCallbacks
}

interface Layer {
  el: HTMLElement
  svg: SVGSVGElement
  shapes: SVGGElement
  annotations: SVGGElement
  overlay: SVGPathElement
  /** Raw (unpadded) viewBox. */
  viewBox: ViewBox
  flipY: boolean
  /** Overview: null. Child view: the drilled parent. */
  parentId: string | null
}

interface MorphPlan {
  el: HTMLElement
  svg: SVGSVGElement
  pairs: (MorphPair & { node: SVGPathElement })[]
  vbStart: number[]
  vbEnd: number[]
  fadeOut: SVGGElement[]
  fadeIn: SVGGElement[]
}

// Seat-block geometry (see renderBlocks). Square edge is constant in CSS px across views; the
// projections differ ~4× in scale, so a map-unit size would swamp a child view.
const BLOCK_ROWS = 5
const BLOCK_PX = 6.5
/**
 * Below this rendered map width the blocks shrink and drop their labels: at phone widths the
 * circuits' blocks overlap each other and their labels collide, and the R/D balance still
 * reads without either.
 */
const COMPACT_MAP_PX = 560
const BLOCK_PX_COMPACT = 4.5
const BLOCK_GAP = 0.3
const LABEL_EM = 10
const ONE_NUDGE_EM = 1.4
const VACANCY_INSET_PX = 0.55
/**
 * Hover/selected enlargement, written as per-frame INLINE transforms and deliberately not a
 * CSS transition: a transform transition on an SVG rect cannot run on the compositor, and
 * Chrome's promotion attempt at animation start/end re-rendered hairline strokes across the
 * whole map for the 90 ms window — a map-wide border flicker.
 */
const BLOCK_SCALE_HOVER = 1.17
const BLOCK_SCALE_SELECTED = 1.24
const BLOCK_SCALE_MS = 90
const NOMINAL_MAP_PX = 900

const nowMs = (): number =>
  typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
const raf = (cb: () => void): number =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(cb)
    : (setTimeout(cb, 16) as unknown as number)
const caf = (id: number): void => {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id)
  else clearTimeout(id)
}
const reducedMotion = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
  return n
}

/** jsdom has no CSS.escape; region ids are attribute values, so quotes and backslashes are all that matter. */
const cssEscape = (s: string): string =>
  typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(s)
    : s.replace(/["\\]/g, "\\$&")

function parseAnchor(value: string | undefined): [number, number] | null {
  if (!value) return null
  const parts = value.split(/[\s,]+/).map(Number)
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null
  return [parts[0]!, parts[1]!]
}

/**
 * Imperative owner of everything inside the map viewport that React must not touch: the
 * adopted overview SVG's hover overlay and seat blocks, the lazily built child-view layers,
 * and the morph layer that interpolates between them. React renders the shell, selector,
 * pane and tooltip around it and drives it through this class from effects.
 */
export class MapStage {
  private readonly opts: StageOptions
  private readonly overview: Layer
  private readonly locals = new Map<string, Layer>()
  private readonly morphPlans = new Map<string, MorphPlan | null>()
  private morphLayer: HTMLElement | null = null
  private morphRAF: number | null = null
  private morphCancel: (() => void) | null = null
  private regions: RegionIndex
  private selected: string | null = null
  private hovered: string | null = null
  private view: { parentId: string | null } = { parentId: null }
  private readonly blockAnim = new WeakMap<SVGGElement, { raf: number | null; scale: number }>()
  private readonly disposers: (() => void)[] = []
  private resizeObserver: ResizeObserver | null = null
  private destroyed = false

  constructor(opts: StageOptions) {
    this.opts = opts
    this.regions = opts.regions
    const svg = opts.overviewLayer.querySelector<SVGSVGElement>("svg[data-drilldown-overview]")
    if (!svg) throw new Error("drilldown stage: overview layer has no svg")
    this.overview = this.adopt(opts.overviewLayer, svg, opts.overviewViewBox, opts.flipY, null)
    this.setLayerState(this.overview, "visible")
    this.wire(this.overview)
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => this.refreshBlocks())
      this.resizeObserver.observe(opts.viewport)
    }
  }

  destroy(): void {
    this.destroyed = true
    this.cancelMorph()
    this.resizeObserver?.disconnect()
    for (const d of this.disposers) d()
    this.disposers.length = 0
    this.detachMorphLayer()
    for (const layer of this.locals.values()) layer.el.remove()
    this.locals.clear()
    this.morphPlans.clear()
    // Leave the server-rendered overview exactly as React rendered it.
    this.overview.overlay.remove()
    this.overview.annotations.replaceChildren()
    this.overview.el.removeAttribute("data-state")
    for (const p of this.overview.shapes.querySelectorAll("[data-selected],[data-hover],[role]")) {
      p.removeAttribute("data-selected")
      p.removeAttribute("data-hover")
      p.removeAttribute("role")
    }
  }

  // ---- public API --------------------------------------------------------------------------

  get currentParent(): string | null {
    return this.view.parentId
  }

  setRegions(regions: RegionIndex): void {
    this.regions = regions
  }

  /** Region ids that get a seat block, drawn on whichever layer holds their geometry/anchor. */
  renderBlocks(regionIds: string[]): void {
    const local = this.view.parentId ? this.locals.get(this.view.parentId) : undefined
    const target = local ?? this.overview
    this.drawBlocks(target, regionIds)
    if (local) this.drawBlocks(this.overview, [])
  }

  setSelected(regionId: string | null): void {
    this.selected = regionId
    for (const layer of this.allLayers()) {
      for (const p of layer.shapes.querySelectorAll<SVGPathElement>("path[data-region-id]")) {
        const covers = regionId !== null && this.covers(p, regionId)
        if (covers) p.setAttribute("data-selected", "")
        else p.removeAttribute("data-selected")
      }
      this.highlightBlocks(layer)
    }
  }

  /** Whether a child view for this parent has real geometry (a parent with none keeps the overview). */
  hasGeometry(asset: DrilldownAsset): boolean {
    return asset.paths.some((p) => p.id)
  }

  async drillIn(
    parentId: string,
    asset: DrilldownAsset,
  ): Promise<"done" | "fallback" | "cancelled" | "no-geometry"> {
    if (this.destroyed) return "cancelled"
    if (!this.hasGeometry(asset) || asset.viewBox === null) {
      this.cancelMorph()
      this.detachMorphLayer()
      this.view = { parentId }
      return "no-geometry"
    }
    const local = this.ensureLocalLayer(parentId, asset)
    this.view = { parentId }
    this.setSelected(null)
    this.opts.callbacks.onHover(null, null)
    const plan = this.morphPlanFor(parentId, local)
    if (!plan) {
      this.cancelMorph()
      this.detachMorphLayer()
      this.setLayerState(this.overview, "fade-out")
      this.setLayerState(local, "fading") // displayed but transparent, so the opacity can transition
      raf(() => {
        if (!this.destroyed && this.view.parentId === parentId) this.setLayerState(local, "fade-in")
      })
      return "fallback"
    }
    this.attachMorphLayer(plan.el)
    this.setLayerState(this.overview, "hidden-hard")
    this.setLayerState(local, "hidden")
    if ((await this.runMorph(plan, true)) !== "done") return "cancelled"
    this.handoff(local, true)
    plan.el.remove()
    return "done"
  }

  async drillOut(): Promise<"done" | "fallback" | "cancelled"> {
    const parentId = this.view.parentId
    const local = parentId ? this.locals.get(parentId) : undefined
    this.view = { parentId: null }
    this.setSelected(null)
    this.opts.callbacks.onHover(null, null)
    const plan = parentId && local ? this.morphPlanFor(parentId, local) : null
    if (!plan) {
      this.cancelMorph()
      this.detachMorphLayer()
      if (local) this.setLayerState(local, "hidden")
      this.setLayerState(this.overview, "visible")
      return "fallback"
    }
    this.attachMorphLayer(plan.el)
    this.handoff(local!, false)
    if ((await this.runMorph(plan, false)) !== "done") return "cancelled"
    this.setLayerState(this.overview, "visible")
    plan.el.remove()
    return "done"
  }

  // ---- layers --------------------------------------------------------------------------------

  private allLayers(): Layer[] {
    return [this.overview, ...this.locals.values()]
  }

  private adopt(
    el: HTMLElement,
    svg: SVGSVGElement,
    viewBox: ViewBox,
    flipY: boolean,
    parentId: string | null,
  ): Layer {
    const shapes = svg.querySelector<SVGGElement>("g[data-drilldown-shapes]")
    const annotations = svg.querySelector<SVGGElement>("g[data-drilldown-annotations]")
    if (!shapes || !annotations) throw new Error("drilldown stage: layer svg is missing its groups")
    svg.querySelectorAll("path[data-drilldown-overlay]").forEach((n) => n.remove())
    const overlay = svgEl("path", { "data-drilldown-overlay": "", d: "" })
    shapes.appendChild(overlay)
    const layer: Layer = { el, svg, shapes, annotations, overlay, viewBox, flipY, parentId }
    // Only now is there a handler behind the shapes, so only now do they advertise as buttons.
    for (const p of shapes.querySelectorAll<SVGPathElement>("path[data-region-id]")) {
      if (this.targetOf(layer, p)) p.setAttribute("role", "button")
    }
    return layer
  }

  private buildLocalLayer(parentId: string, asset: DrilldownAsset): Layer {
    const raw = asset.viewBox!
    const vb = padViewBox(raw)
    const el = document.createElement("div")
    el.setAttribute("data-drilldown-layer", "local")
    el.setAttribute("data-parent-id", parentId)
    const svg = svgEl("svg", {
      "data-drilldown-local": "",
      viewBox: viewBoxAttr(vb),
      preserveAspectRatio: "xMidYMid meet",
      overflow: "visible",
      role: "group",
      "aria-label": `${this.regions.byId[parentId]?.label ?? parentId} detail map`,
    })
    const shapes = svgEl("g", { "data-drilldown-shapes": "" })
    if (asset.flipY) shapes.setAttribute("transform", flipTransform(raw))
    const parents: SVGPathElement[] = []
    const children: SVGPathElement[] = []
    const decorative: SVGPathElement[] = []
    for (const p of asset.paths) {
      const node = svgEl("path", { d: p.d })
      if (!p.id) {
        node.setAttribute("data-role", "decorative")
        decorative.push(node)
        continue
      }
      node.setAttribute("data-region-id", p.id)
      if (p.layer) node.setAttribute("data-layer", p.layer)
      if (p.inset) node.setAttribute("data-inset", "true")
      if (p.id === parentId || !p.parentId) {
        node.setAttribute("data-role", "parent")
        parents.push(node)
      } else {
        node.setAttribute("data-role", "child")
        node.setAttribute("data-parent-id", p.parentId)
        node.setAttribute("tabindex", "0")
        node.setAttribute("aria-label", this.regions.byId[p.id]?.label ?? p.id)
        children.push(node)
      }
    }
    for (const n of parents) shapes.appendChild(n)
    for (const n of children) shapes.appendChild(n)
    for (const n of decorative) shapes.appendChild(n)
    for (const n of parents) {
      const outline = svgEl("path", {
        d: n.getAttribute("d") ?? "",
        "data-role": "outline",
        "data-outline-for": n.getAttribute("data-region-id") ?? "",
      })
      shapes.appendChild(outline)
    }
    const annotations = svgEl("g", { "data-drilldown-annotations": "" })
    svg.append(shapes, annotations)
    el.appendChild(svg)
    this.opts.layersHost.appendChild(el)
    const layer = this.adopt(el, svg, raw, asset.flipY, parentId)
    this.setLayerState(layer, "hidden")
    this.wire(layer)
    return layer
  }

  private ensureLocalLayer(parentId: string, asset: DrilldownAsset): Layer {
    let layer = this.locals.get(parentId)
    if (!layer) {
      layer = this.buildLocalLayer(parentId, asset)
      this.locals.set(parentId, layer)
    }
    return layer
  }

  private setLayerState(layer: Layer, state: LayerState): void {
    layer.el.setAttribute("data-state", state)
  }

  /** Show/hide a layer with no transition, flushed before the caller drops the morph layer. */
  private handoff(layer: Layer, show: boolean): void {
    layer.el.setAttribute("data-no-transition", "")
    this.setLayerState(layer, show ? "visible" : "hidden")
    void layer.el.offsetWidth
    layer.el.removeAttribute("data-no-transition")
  }

  // ---- interaction ----------------------------------------------------------------------------

  /** Which region a pointer on this path targets in the layer's view, or null if inert. */
  private targetOf(layer: Layer, path: SVGPathElement): string | null {
    const id = path.getAttribute("data-region-id")
    if (!id) return null
    const role = path.getAttribute("data-role")
    if (layer.parentId === null) {
      if (role === "parent") return id
      if (role === "child" && path.getAttribute("data-inset") === "true")
        return path.getAttribute("data-parent-id")
      return null
    }
    return role === "child" ? id : null
  }

  private covers(path: SVGPathElement, regionId: string): boolean {
    if (path.getAttribute("data-region-id") === regionId) return true
    return (
      path.getAttribute("data-inset") === "true" &&
      path.getAttribute("data-parent-id") === regionId &&
      path.getAttribute("data-role") === "child"
    )
  }

  /** A parent's outline is mainland-only, so its hover outline adds every inset that points at it. */
  private overlayPathFor(layer: Layer, regionId: string): string {
    const parts: string[] = []
    for (const p of layer.shapes.querySelectorAll<SVGPathElement>(
      `path[data-region-id][data-role]:not([data-role="outline"])`,
    )) {
      if (this.covers(p, regionId)) parts.push(p.getAttribute("d") ?? "")
    }
    return parts.join(" ")
  }

  private setHover(
    layer: Layer,
    regionId: string | null,
    point: { x: number; y: number } | null,
  ): void {
    if (regionId) {
      layer.overlay.setAttribute("d", this.overlayPathFor(layer, regionId))
      layer.overlay.setAttribute("data-visible", "")
    } else {
      layer.overlay.removeAttribute("data-visible")
    }
    this.hovered = regionId
    this.highlightBlocks(layer)
    this.opts.callbacks.onHover(regionId, point)
  }

  private wire(layer: Layer): void {
    const svg = layer.svg
    const pathFrom = (t: EventTarget | null): SVGPathElement | null =>
      t instanceof Element ? t.closest<SVGPathElement>("path[data-region-id]") : null
    const blockFrom = (t: EventTarget | null): SVGGElement | null =>
      t instanceof Element ? t.closest<SVGGElement>("g[data-drilldown-block]") : null
    const targetFrom = (t: EventTarget | null): string | null => {
      const block = blockFrom(t)
      if (block) return block.getAttribute("data-region-id")
      const path = pathFrom(t)
      return path ? this.targetOf(layer, path) : null
    }

    const onOver = (e: PointerEvent): void => {
      const id = targetFrom(e.target)
      if (id && id !== this.hovered) this.setHover(layer, id, { x: e.clientX, y: e.clientY })
      else if (!id && this.hovered) this.setHover(layer, null, null)
    }
    const onMove = (e: PointerEvent): void => {
      if (this.hovered) this.opts.callbacks.onHover(this.hovered, { x: e.clientX, y: e.clientY })
    }
    const onLeave = (): void => {
      if (this.hovered) this.setHover(layer, null, null)
    }
    const onClick = (e: MouseEvent): void => {
      const id = targetFrom(e.target)
      // A keyboard "click" on a focused path arrives here too, with detail 0.
      if (id) this.opts.callbacks.onSelect(id, e.detail === 0 ? "keyboard" : "pointer")
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Enter" && e.key !== " ") return
      const id = targetFrom(e.target)
      if (!id) return
      e.preventDefault()
      this.opts.callbacks.onSelect(id, "keyboard")
    }
    const onFocus = (e: FocusEvent): void => {
      const path = pathFrom(e.target)
      const id = path ? this.targetOf(layer, path) : null
      if (!id || !path) return
      const r = path.getBoundingClientRect()
      this.setHover(layer, id, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    const onBlur = (): void => {
      if (this.hovered) this.setHover(layer, null, null)
    }

    svg.addEventListener("pointerover", onOver)
    svg.addEventListener("pointermove", onMove)
    svg.addEventListener("pointerleave", onLeave)
    svg.addEventListener("click", onClick)
    svg.addEventListener("keydown", onKey)
    svg.addEventListener("focusin", onFocus)
    svg.addEventListener("focusout", onBlur)
    this.disposers.push(() => {
      svg.removeEventListener("pointerover", onOver)
      svg.removeEventListener("pointermove", onMove)
      svg.removeEventListener("pointerleave", onLeave)
      svg.removeEventListener("click", onClick)
      svg.removeEventListener("keydown", onKey)
      svg.removeEventListener("focusin", onFocus)
      svg.removeEventListener("focusout", onBlur)
    })
  }

  // ---- seat blocks ----------------------------------------------------------------------------

  /**
   * Rendered width of a layer in CSS px, derived from the viewport (an idle layer is
   * display:none and measures 0). Reproduces the letterbox `max-width/max-height: 100%` produce.
   */
  private renderedWidth(layer: Layer): number {
    const [, , vw, vh] = layer.viewBox
    const cw = this.opts.viewport.clientWidth
    const ch = this.opts.viewport.clientHeight
    if (!(cw > 0 && ch > 0 && vw > 0 && vh > 0)) return NOMINAL_MAP_PX
    return vw * Math.min(cw / vw, ch / vh)
  }

  private shapeAnchor(layer: Layer, regionId: string): [number, number] | null {
    const path =
      layer.shapes.querySelector<SVGPathElement>(
        `path[data-region-id="${cssEscape(regionId)}"][data-role="parent"]:not([data-inset])`,
      ) ??
      layer.shapes.querySelector<SVGPathElement>(
        `path[data-region-id="${cssEscape(regionId)}"]:not([data-role="outline"])`,
      )
    return path ? largestSubpathCentre(path.getAttribute("d")) : null
  }

  private drawBlocks(layer: Layer, regionIds: string[]): void {
    layer.annotations.querySelectorAll("g[data-drilldown-blocks]").forEach((n) => n.remove())
    const seats = this.opts.seats
    if (!seats || regionIds.length === 0) return
    const group = svgEl("g", { "data-drilldown-blocks": "" })
    const [, , vw] = layer.viewBox
    const k = flipConstant(layer.viewBox)
    const rendered = this.renderedWidth(layer)
    // Compactness follows the room the page gives the map, not the rendered width: a tall
    // child map (one circuit) letterboxes narrow on a wide screen and still has plenty of
    // space for full-size blocks and their labels.
    const compact = (this.opts.viewport.clientWidth || rendered) < COMPACT_MAP_PX
    if (compact) layer.svg.setAttribute("data-drilldown-compact", "")
    else layer.svg.removeAttribute("data-drilldown-compact")
    const unitsPerPx = vw / rendered
    const e = (compact ? BLOCK_PX_COMPACT : BLOCK_PX) * unitsPerPx
    const pitch = e * (1 + BLOCK_GAP)

    for (const id of regionIds) {
      const region = this.regions.byId[id]
      if (!region) continue
      const total = Number(region.facts[seats.totalFact])
      if (!Number.isFinite(total) || total <= 0) continue
      const squares: { color: string | null }[] = []
      for (const g of seats.groups) {
        const n = Number(region.facts[g.fact])
        for (let i = 0; i < (Number.isFinite(n) ? n : 0); i++) squares.push({ color: g.color })
      }
      // Size to whichever is larger so no member is ever dropped from the block.
      while (squares.length < total) squares.push({ color: null })
      const anchor =
        (seats.anchorFact ? parseAnchor(region.facts[seats.anchorFact]) : null) ??
        this.shapeAnchor(layer, id)
      if (!anchor) continue
      const cols = Math.ceil(squares.length / BLOCK_ROWS)
      const wide = cols * pitch - (pitch - e)
      const tall = Math.min(squares.length, BLOCK_ROWS) * pitch - (pitch - e)
      const x0 = anchor[0] - wide / 2
      // the annotation group sits outside the Y-flip group: convert geographic-Y-up to screen-Y-down
      const y0 = (layer.flipY ? k - anchor[1] : anchor[1]) - tall / 2

      const block = svgEl("g", { "data-drilldown-block": "", "data-region-id": id })
      const labelText =
        !compact && seats.labelFact ? region.facts[seats.labelFact]?.trim() || null : null
      const m = e * 0.6
      const top = labelText ? y0 - e * 0.45 - e * 1.9 : y0 - m
      block.appendChild(
        svgEl("rect", {
          "data-block-hit": "",
          x: x0 - m,
          y: top - m * 0.5,
          width: Math.max(wide, labelText ? e * 3.2 : 0) + 2 * m,
          height: y0 + tall + m - (top - m * 0.5),
        }),
      )
      squares.forEach((sq, i) => {
        const inset = sq.color === null ? VACANCY_INSET_PX * unitsPerPx : 0
        const rect = svgEl("rect", {
          "data-block-seat": sq.color === null ? "vacant" : "filled",
          x: x0 + Math.floor(i / BLOCK_ROWS) * pitch + inset,
          y: y0 + (i % BLOCK_ROWS) * pitch + inset,
          width: e - 2 * inset,
          height: e - 2 * inset,
        })
        if (sq.color !== null) rect.style.fill = sq.color
        block.appendChild(rect)
      })
      if (labelText) {
        // Browsers clamp font-size at 10000px and these viewBoxes are millions of units across,
        // so the label rides in a scaled group with a small font.
        const scale = (e * 1.9) / LABEL_EM
        const tg = svgEl("g", { transform: `translate(${x0} ${y0 - e * 0.45}) scale(${scale})` })
        const t = svgEl("text", {
          "data-block-label": "",
          "font-size": LABEL_EM,
          // Optical alignment: a leading "1" puts its stem ~2px right of where other glyphs' mass sits.
          x: /^1/.test(labelText) ? -ONE_NUDGE_EM : 0,
        })
        t.textContent = labelText
        tg.appendChild(t)
        block.appendChild(tg)
      }
      group.appendChild(block)
    }
    layer.annotations.appendChild(group)
    this.highlightBlocks(layer)
  }

  private refreshBlocks(): void {
    if (this.destroyed) return
    const ids = new Map<Layer, string[]>()
    for (const layer of this.allLayers()) {
      ids.set(
        layer,
        Array.from(layer.annotations.querySelectorAll("g[data-drilldown-block]")).map(
          (b) => b.getAttribute("data-region-id") ?? "",
        ),
      )
    }
    for (const [layer, list] of ids) if (list.length) this.drawBlocks(layer, list)
    // cached plans carry cloned block groups sized for the old viewport
    this.morphPlans.clear()
  }

  private highlightBlocks(layer: Layer): void {
    for (const block of layer.annotations.querySelectorAll<SVGGElement>(
      "g[data-drilldown-block]",
    )) {
      const id = block.getAttribute("data-region-id")
      const selected = id !== null && id === this.selected
      const hovered = id !== null && id === this.hovered
      block.toggleAttribute("data-selected", selected)
      block.toggleAttribute("data-hover", hovered)
      this.animateBlockScale(
        block,
        selected ? BLOCK_SCALE_SELECTED : hovered ? BLOCK_SCALE_HOVER : 1,
      )
    }
  }

  private animateBlockScale(block: SVGGElement, target: number): void {
    const state = this.blockAnim.get(block) ?? { raf: null, scale: 1 }
    this.blockAnim.set(block, state)
    if (state.raf !== null) {
      caf(state.raf)
      state.raf = null
    }
    const squares = block.querySelectorAll<SVGRectElement>("rect[data-block-seat]")
    const apply = (k: number): void => {
      state.scale = k
      const t = k === 1 ? "" : `scale(${k})`
      squares.forEach((sq) => {
        sq.style.transform = t
      })
    }
    const from = state.scale
    if (from === target || reducedMotion()) {
      apply(target)
      return
    }
    const t0 = nowMs()
    const step = (): void => {
      const t = Math.min(1, (nowMs() - t0) / BLOCK_SCALE_MS)
      const eased = 1 - (1 - t) ** 3
      apply(t < 1 ? from + (target - from) * eased : target)
      state.raf = t < 1 ? raf(step) : null
    }
    step()
  }

  // ---- morph ------------------------------------------------------------------------------------

  private morphSources(layer: Layer): MorphSource[] {
    const out: MorphSource[] = []
    let deco = 0
    for (const p of layer.shapes.querySelectorAll<SVGPathElement>("path[data-role]")) {
      const role = p.getAttribute("data-role")
      const d = p.getAttribute("d") ?? ""
      if (role === "outline")
        out.push({ key: `outline:${p.getAttribute("data-outline-for")}`, d, inset: false })
      else if (role === "decorative")
        out.push({ key: `deco:${layer.parentId ?? "overview"}:${deco++}`, d, inset: false })
      else
        out.push({
          key: `shape:${p.getAttribute("data-region-id")}`,
          d,
          inset: p.getAttribute("data-inset") === "true",
        })
    }
    return out
  }

  private buildMorphPlan(local: Layer): MorphPlan | null {
    const overviewSources = this.morphSources(this.overview)
    const localSources = this.morphSources(local)
    const pairing = buildMorphPairs(
      overviewSources,
      localSources,
      this.overview.flipY ? flipConstant(this.overview.viewBox) : 0,
      local.flipY ? flipConstant(local.viewBox) : 0,
    )
    if (!pairing) return null
    if (!this.overview.flipY || !local.flipY) return null // mixed conventions: crossfade instead

    const attrsByKey = new Map<string, SVGPathElement>()
    for (const layer of [this.overview, local]) {
      let deco = 0
      for (const p of layer.shapes.querySelectorAll<SVGPathElement>("path[data-role]")) {
        const role = p.getAttribute("data-role")
        const key =
          role === "outline"
            ? `outline:${p.getAttribute("data-outline-for")}`
            : role === "decorative"
              ? `deco:${layer.parentId ?? "overview"}:${deco++}`
              : `shape:${p.getAttribute("data-region-id")}`
        if (!attrsByKey.has(key) || layer === local) attrsByKey.set(key, p)
      }
    }
    const cloneFor = (key: string, d: string): SVGPathElement => {
      const src = attrsByKey.get(key)
      const node = src ? (src.cloneNode(false) as SVGPathElement) : svgEl("path")
      node.removeAttribute("id")
      node.removeAttribute("tabindex")
      node.removeAttribute("role")
      node.removeAttribute("aria-label")
      node.removeAttribute("data-selected")
      node.removeAttribute("data-hover")
      node.setAttribute("d", d)
      return node
    }

    const vbStart = padViewBox(this.overview.viewBox)
    const vbEnd = padViewBox(local.viewBox)
    const svg = svgEl("svg", {
      "data-drilldown-morph": "",
      viewBox: viewBoxAttr(vbStart),
      preserveAspectRatio: "xMidYMid meet",
      overflow: "visible",
      "aria-hidden": "true",
    })
    // Fading elements are grouped so the OPACITY LIVES ON THE GROUP: opacity < 1 forces a
    // transparency layer the size of the element's bounds, and ~100 of them per morph is what
    // made the original drag. Four groups = four buffers.
    const shapesOut = svgEl("g", { "data-morph-fade": "out" })
    const shapesMorph = svgEl("g")
    const shapesIn = svgEl("g", { "data-morph-fade": "in" })
    const blocksOut = svgEl("g", { "data-morph-fade": "out" })
    const blocksIn = svgEl("g", { "data-morph-fade": "in" })
    svg.append(shapesOut, shapesMorph, shapesIn, blocksOut, blocksIn)

    const pairs: MorphPlan["pairs"] = pairing.pairs.map((pr) => {
      const node = cloneFor(pr.key, serializePath(pr.start))
      shapesMorph.appendChild(node)
      return { ...pr, node }
    })
    for (const f of pairing.fadeOut) shapesOut.appendChild(cloneFor(f.key, f.d))
    for (const f of pairing.fadeIn) shapesIn.appendChild(cloneFor(f.key, f.d))
    // Seat blocks belong to exactly one view and live in unflipped annotation coordinates, so
    // they crossfade too, riding the interpolating viewBox glued to their own map.
    for (const [src, into] of [
      [this.overview, blocksOut],
      [local, blocksIn],
    ] as const) {
      const blocks = src.annotations.querySelector("g[data-drilldown-blocks]")
      if (blocks) into.appendChild(blocks.cloneNode(true))
    }

    const el = document.createElement("div")
    el.setAttribute("data-drilldown-layer", "morph")
    el.appendChild(svg)
    return {
      el,
      svg,
      pairs,
      vbStart,
      vbEnd,
      fadeOut: [shapesOut, blocksOut],
      fadeIn: [shapesIn, blocksIn],
    }
  }

  /** Cached per parent; a null result is cached too — a view that cannot morph is not re-checked. */
  private morphPlanFor(parentId: string, local: Layer): MorphPlan | null {
    if (!this.morphPlans.has(parentId)) {
      const plan = this.buildMorphPlan(local)
      if (!plan)
        console.warn(`[interactive-map] ${parentId}: vertex morph unavailable → zoom + crossfade`)
      this.morphPlans.set(parentId, plan)
    }
    const plan = this.morphPlans.get(parentId) ?? null
    if (plan) {
      for (const pr of plan.pairs) pr.node.setAttribute("d", serializePath(pr.start))
      this.setFades(plan, 0)
      plan.svg.setAttribute("viewBox", plan.vbStart.join(" "))
    }
    return plan
  }

  private setFades(plan: MorphPlan, u: number): void {
    for (const n of plan.fadeOut) n.style.opacity = String(1 - u)
    for (const n of plan.fadeIn) n.style.opacity = String(u)
  }

  /**
   * Attach this morph's layer and drop any OTHER stale one. When a drill-out morph is
   * interrupted by a drill-in of a different parent, the first layer (a whole map) would
   * otherwise stay attached with nothing to remove it, and they pile up until every later
   * morph repaints several dead maps per frame.
   */
  private attachMorphLayer(el: HTMLElement): void {
    if (this.morphLayer && this.morphLayer !== el) this.morphLayer.remove()
    this.morphLayer = el
    if (!el.isConnected) this.opts.layersHost.appendChild(el)
  }

  private detachMorphLayer(): void {
    this.morphLayer?.remove()
    this.morphLayer = null
  }

  private cancelMorph(): void {
    this.morphCancel?.()
  }

  /** Resolves "done" if it ran to the end, or "cancelled" if a newer transition took over. */
  private runMorph(plan: MorphPlan, forward: boolean): Promise<"done" | "cancelled"> {
    this.cancelMorph()
    return new Promise((resolve) => {
      const settle = (how: "done" | "cancelled"): void => {
        if (how === "cancelled" && this.morphRAF !== null) caf(this.morphRAF)
        this.morphRAF = null
        this.morphCancel = null
        resolve(how)
      }
      this.morphCancel = () => settle("cancelled")
      const dur = reducedMotion() ? 0 : MORPH_MS
      const t0 = nowMs()
      let lastCommit = -Infinity
      const frame = (): void => {
        const elapsed = nowMs() - t0
        // A clock that never advances must not keep this loop alive forever.
        if (elapsed > MORPH_MS * 5) {
          this.setFades(plan, forward ? 1 : 0)
          settle("done")
          return
        }
        const t = dur > 0 ? Math.min(1, elapsed / dur) : 1
        // Commit-rate cap: skip this vsync tick entirely — no DOM writes — when the last commit
        // is too recent. The final frame always commits so the end state is exact.
        if (t < 1 && elapsed - lastCommit < MORPH_MIN_COMMIT_MS) {
          this.morphRAF = raf(frame)
          return
        }
        lastCommit = elapsed
        const u = forward ? easeInOutCubic(t) : 1 - easeInOutCubic(t)
        for (const pr of plan.pairs) {
          lerpInto(pr.start, pr.end, pr.work, u)
          pr.node.setAttribute("d", serializePath(pr.work))
        }
        const vb = lerpViewBox(plan.vbStart, plan.vbEnd, u)
        plan.svg.setAttribute("viewBox", vb.join(" "))
        this.setFades(plan, u)
        if (t < 1) this.morphRAF = raf(frame)
        else settle("done")
      }
      this.morphRAF = raf(frame)
    })
  }
}
