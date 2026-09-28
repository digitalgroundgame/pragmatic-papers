import {
  cameraViewBox,
  flipConstant,
  flipTransform,
  holdCamera,
  padViewBox,
  viewBoxAttr,
} from "./geometry"
import {
  buildMorphPairs,
  crossApexViewBox,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  frameForContent,
  frameScale,
  frameTransform,
  largestSubpathCentre,
  lerpInto,
  lerpViewBox,
  MORPH_MIN_COMMIT_MS,
  MORPH_MS,
  parsePathAbs,
  type MorphPair,
  type MorphSource,
  pullbackViewBox,
  serializePath,
  subpathBounds,
  zoomProgress,
  zoomViewBox,
} from "./morph"
import type { ClusterBox } from "./cluster"
import { layoutCluster } from "./cluster"
import type { DrilldownAsset, RegionIndex, SeatBlockConfig, SeatCluster, ViewBox } from "./types"

const SVGNS = "http://www.w3.org/2000/svg"

export type LayerState = "visible" | "hidden" | "hidden-hard" | "fade-out" | "fading" | "fade-in"

/** Where a drag happened. `writable` is false when the position is computed, not declared. */
export interface DragOrigin {
  layer: string
  writable: boolean
}

export interface StageCallbacks {
  onHover(regionId: string | null, point: { x: number; y: number } | null): void
  /** `via` lets the client move keyboard focus into the pane a keyboard selection opened. */
  onSelect(regionId: string, via: "pointer" | "keyboard"): void
  /** Only while layout editing is on: an editor has dragged a seat block to a new place. */
  onAnchorMoved?(regionId: string, at: [number, number], where: DragOrigin): void
  /** Only while layout editing is on: an editor has nudged a region's shapes. */
  onRegionMoved?(regionId: string, by: [number, number], where: DragOrigin): void
  /** A second press put something back where the files say it goes. */
  onLayoutReset?(regionId: string, where: DragOrigin): void
  /** How far the camera has moved in, so the controls can say whether there is a way back. */
  onCamera?(zoom: number): void
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
  /** Hover mark for the parts an outline would swallow whole. */
  overlayTiny: SVGPathElement
  /** The selected region's outline: the same mark as the hover one, but it stays. */
  selectedOverlay: SVGPathElement
  /** Raw (unpadded) viewBox. */
  viewBox: ViewBox
  /** The viewBox actually on the element: padded, and widened by `gutter` on the left. */
  render: ViewBox
  /** Map units reserved left of the map for the parent's own seat block; 0 on the overview. */
  gutter: number
  flipY: boolean
  /** Overview: null. Child view: the drilled parent. */
  parentId: string | null
  /** Where a cluster put its members, worked out from their measured sizes. */
  clusterAnchors: Map<string, [number, number]>
}

/** What every block in one drawing shares: its scale, and the fields the size is read from. */
interface BlockContext {
  seats: SeatBlockConfig
  compact: boolean
  /** Square edge, in map units. */
  e: number
  pitch: number
  unitsPerPx: number
  /** The Y flip's constant, so an anchor in geographic Y can be put on the screen. */
  k: number
}

/**
 * Where the reader has moved the map to: `k` is how far in, where 1 is the whole map, and
 * `cx`/`cy` are what sits under the middle of the frame, in the current layer's drawn units.
 * One camera and not one per layer — only one map is ever on screen, and moving resets it.
 */
interface Camera {
  k: number
  cx: number
  cy: number
}

interface MorphPlan {
  el: HTMLElement
  svg: SVGSVGElement
  pairs: (MorphPair & { node: SVGPathElement })[]
  vbStart: number[]
  /** Read live, never captured: a child's box is re-cut whenever the viewport changes. */
  layer: Layer
  /** The paired shapes' extent in each frame — how far the drawing has moved by any point. */
  contentFrom: number[]
  contentTo: number[]
  /** Cloned seat blocks, and the drawing they were taken from, so a redraw can be noticed. */
  blocksOut: SVGGElement
  blocksIn: SVGGElement
  blocksGen: number
  fadeOut: SVGGElement[]
  fadeIn: SVGGElement[]
}

// Seat-block geometry (see renderBlocks). The square edge is constant in CSS px across views:
// the projections differ ~4x in scale, so a map-unit size would swamp a child view.
/** Rows in a seat block. Four rather than five keeps a bench of 29 from reading as a sliver. */
const BLOCK_ROWS = 4
const BLOCK_PX = 6.5
/**
 * The smallest an island can be and still show a 2px outline as an outline. Below it the mark
 * is a fill: the Virgin Islands are about five pixels across on the national map.
 */
const OUTLINE_MIN_PX = 12
/**
 * How long a second press still counts as a double press, while layout editing is on. Counted
 * from the pointer rather than heard as `dblclick`: the drag has to preventDefault the
 * pointerdown, and that takes the compatibility mouse events — `dblclick` among them — with it.
 */
const DOUBLE_PRESS_MS = 350
/** Below this width blocks shrink and drop their labels; the R/D balance still reads. */
const COMPACT_MAP_PX = 560
/** Between members of a cluster, in CSS px, when the profile does not say. */
const CLUSTER_GAP_PX = 12
/** Between a frame-placed cluster and the edge of the frame, in CSS px, likewise. */
const CLUSTER_INSET_PX = 10
/** Under a fiftieth of a px on screen is not a move; it is arithmetic that did not quite land. */
const CLUSTER_EPSILON_PX = 0.02
const BLOCK_PX_COMPACT = 4.5
const BLOCK_GAP = 0.3
const LABEL_EM = 10
const ONE_NUDGE_EM = 1.4
const VACANCY_INSET_PX = 0.55
/**
 * Hover/selected enlargement, written as per-frame inline transforms and deliberately not a
 * CSS transition: a transform transition on an SVG rect cannot run on the compositor, and
 * Chrome's promotion attempt re-rendered hairline strokes map-wide for the 90 ms window.
 */
const BLOCK_SCALE_HOVER = 1.17
const BLOCK_SCALE_SELECTED = 1.24
const BLOCK_SCALE_MS = 90
const NOMINAL_MAP_PX = 900
/** How far in the camera can be pushed, and how far one press takes it. */
export const ZOOM_MAX = 6
export const ZOOM_STEP = 1.5
/** Where the camera lands on a court that has no territory to be found by. */
const FOCUS_ZOOM = 1.8
/** How long the camera takes to fly somewhere it was sent, rather than dragged. */
const CAMERA_MS = 340
/** Pointer travel, in CSS px, that makes a press a drag of the map rather than a choice on it. */
const PAN_SLOP = 4
/**
 * How much zoom a pixel of wheel travel is worth, applied as a ratio so a trackpad's stream of
 * small deltas and a mouse's ~100 px notch both feel like the same gesture. A notch is ~1.16x,
 * so three of them are about one press of the button.
 */
const WHEEL_ZOOM_RATE = 0.0015
/** A wheel event's travel in CSS px, whatever unit the device reports it in. */
const wheelPx = (e: WheelEvent, viewportHeight: number): number =>
  e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * viewportHeight : e.deltaY
/** How far one press of the arrow keys moves the map, as a fraction of the frame. */
const KEY_PAN_FRACTION = 0.18
/** Breathing room either side of the parent's seat block in its gutter, in CSS px. */
const PARENT_GUTTER_MARGIN_PX = 18
/**
 * Extra headroom above a child map, as a fraction of its (already padded) height. A seat
 * block grows upward from its anchor, and a region anchored near the true top of its map —
 * Northern Alabama's, on the Eleventh Circuit's — reaches past the shared edge pad
 * (`VIEWBOX_PAD_FRACTION`) and crowds the viewport's own edge. The overview has no blocks
 * anchored that tight to its own bounds, so this is child views only.
 */
const CHILD_TOP_PAD_FRACTION = 0.05

/**
 * Hover forgiveness. Regions share their borders, so a pointer resting on a seam crosses
 * between two of them several times a second and everything it lights strobes. A *change* of
 * target has to hold for a moment; the first region of a sweep still lights up instantly.
 */
const HOVER_SWITCH_MS = 80
/** Losing the target gets longer: the hairline between two regions reads as background. */
const HOVER_CLEAR_MS = 160

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

/** A declared anchor, checked rather than trusted: it arrives through the payload like anything else. */
function toAnchor(value: readonly number[] | undefined): [number, number] | null {
  if (!value || value.length !== 2) return null
  const [x, y] = value
  return Number.isFinite(x) && Number.isFinite(y) ? [x as number, y as number] : null
}

/**
 * What a block actually draws, in the block's own units. Measured on the group, since a label
 * rides in a scaled group whose `getBBox` is in units of its own. The two rectangles built
 * from a guess at the label's width are folded away first, or the answer is the guess.
 */
function contentBounds(block: Element | null): DOMRect | null {
  if (!(block instanceof SVGGraphicsElement)) return null
  const guessed = [...block.children].filter(
    (c) => c.hasAttribute("data-block-plinth") || c.hasAttribute("data-block-hit"),
  )
  const held = guessed.map((c) => [c.getAttribute("width"), c.getAttribute("height")] as const)
  for (const c of guessed) {
    c.setAttribute("width", "0")
    c.setAttribute("height", "0")
  }
  const box = block.getBBox()
  guessed.forEach((c, i) => {
    const [w, h] = held[i]!
    if (w !== null) c.setAttribute("width", w)
    if (h !== null) c.setAttribute("height", h)
  })
  return box.width > 0 && box.height > 0 ? box : null
}

function parseAnchor(value: string | undefined): [number, number] | null {
  if (!value) return null
  const parts = value.split(/[\s,]+/).map(Number)
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null
  return [parts[0]!, parts[1]!]
}

/**
 * Imperative owner of everything inside the map viewport that React must not touch: the
 * adopted overview SVG's overlay and seat blocks, the lazily built child layers, and the
 * morph layer between them. React renders the shell around it and drives it from effects.
 */
export class MapStage {
  private readonly opts: StageOptions
  private readonly overview: Layer
  private readonly locals = new Map<string, Layer>()
  private readonly morphPlans = new Map<string, MorphPlan | null>()
  private morphLayer: HTMLElement | null = null
  /** Bumped by every block redraw, so a morph in flight can notice its clones went stale. */
  private blocksGen = 0
  /**
   * Moved by hand this session, keyed by the layer the drag happened on and then the region.
   * The layer is half the answer: the Ninth's block has one place on the national map and
   * another in the gutter of its own, and the two numbers mean entirely different things.
   */
  private movedAnchors = new Map<string, Map<string, [number, number]>>()
  /** Shapes nudged by hand this session, per layer, in the geometry file's own units. */
  private movedRegions = new Map<string, Map<string, [number, number]>>()
  private layoutEditing = false
  /** The last thing pressed while editing, so a second press on it can mean "put it back". */
  private lastTap: { key: string; at: number } | null = null
  private morphRAF: number | null = null
  private morphCancel: (() => void) | null = null
  private regions: RegionIndex
  private selected: string | null = null
  private hovered: string | null = null
  /** A hover change waiting out its forgiveness delay — see HOVER_SWITCH_MS. */
  private pendingHover: {
    id: string | null
    point: { x: number; y: number } | null
    timer: ReturnType<typeof setTimeout>
  } | null = null
  private view: { parentId: string | null } = { parentId: null }
  /** Null while the whole map is on screen — see `Camera`. */
  private camera: Camera | null = null
  /** Whether the camera was sent somewhere rather than driven there, so it can be taken back. */
  private cameraAuto = false
  private cameraRAF: number | null = null
  /** Set for the instant between a pan ending and the click it would otherwise have been. */
  private suppressClick = false
  private readonly blockAnim = new WeakMap<SVGGElement, { raf: number | null; scale: number }>()
  private readonly disposers: (() => void)[] = []
  private resizeObserver: ResizeObserver | null = null
  private destroyed = false

  constructor(opts: StageOptions) {
    this.opts = opts
    this.regions = opts.regions
    const svg = opts.overviewLayer.querySelector<SVGSVGElement>("svg[data-drilldown-overview]")
    if (!svg) throw new Error("drilldown stage: overview layer has no svg")
    // The overview is server-rendered by DrilldownOverviewSvg, which pads and never gutters.
    this.overview = this.adopt(
      opts.overviewLayer,
      svg,
      opts.overviewViewBox,
      { vb: padViewBox(opts.overviewViewBox), gutter: 0 },
      opts.flipY,
      null,
    )
    this.setLayerState(this.overview, "visible")
    this.wire(this.overview)
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => this.refreshBlocks())
      this.resizeObserver.observe(opts.viewport)
    }
  }

  destroy(): void {
    this.destroyed = true
    this.cancelPendingHover()
    this.cancelCameraFlight()
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
    this.overview.selectedOverlay.remove()
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

  /**
   * Let an editor drag the seat blocks and read off where they put them, in the form
   * `anchors.json` wants. Nothing here is a secret — every anchor is already in the payload
   * the page ships — the gate only keeps the furniture still for a reader who did not ask.
   */
  setLayoutEditing(on: boolean): void {
    if (this.layoutEditing === on) return
    this.layoutEditing = on
    for (const layer of this.allLayers()) {
      layer.annotations.toggleAttribute("data-drilldown-layout-editing", on)
    }
    if (on) return
    this.movedAnchors.clear()
    for (const id of [...this.movedRegions.values()].flatMap((m) => [...m.keys()]))
      this.shapesOf(id).forEach((p) => p.removeAttribute("transform"))
    this.movedRegions.clear()
  }

  /**
   * The regions drawn at exactly this outline — usually one, occasionally two, since the
   * D.C. Circuit's only district is the circuit and the export emits that shape at both
   * levels. By geometry and not by parentage: the Ninth's mainland and Alaska must not move
   * together, since where the insets sit is the placement being decided.
   */
  private coincidentIds(layer: Layer, d: string | null): string[] {
    const ids = new Set<string>()
    if (!d) return []
    for (const p of layer.shapes.querySelectorAll<SVGPathElement>("path[data-region-id]")) {
      const id = p.getAttribute("data-region-id")
      if (id && p.getAttribute("d") === d) ids.add(id)
    }
    return [...ids]
  }

  /**
   * Whether this press is a second one on the same thing, and therefore means "put it back".
   * Records the press either way, so the next one can ask the same question.
   */
  private isDoublePress(layer: Layer, id: string): boolean {
    const key = `${this.layerKey(layer)}:${id}`
    const at = nowMs()
    const again = this.lastTap?.key === key && at - this.lastTap.at < DOUBLE_PRESS_MS
    this.lastTap = again ? null : { key, at }
    return again
  }

  /** Put the marks back over the shapes: they are separate paths, so a drag leaves them. */
  private refreshMarks(layer: Layer): void {
    if (this.hovered) {
      const marks = this.overlayPathsFor(layer, this.hovered)
      layer.overlay.setAttribute("d", marks.outline)
      layer.overlayTiny.setAttribute("d", marks.tiny)
    }
    if (this.selected) {
      layer.selectedOverlay.setAttribute("d", this.overlayPathsFor(layer, this.selected).outline)
    }
  }

  /** Forget what was dragged, for every piece drawn at one spot, and put them back. */
  private resetLayout(layer: Layer, ids: string[], kind: "anchor" | "region"): void {
    const key = this.layerKey(layer)
    for (const id of ids) {
      if (kind === "anchor") this.movedAnchors.get(key)?.delete(id)
      else {
        this.movedRegions.get(key)?.delete(id)
        this.shapesOf(id).forEach((p) => p.removeAttribute("transform"))
        this.refreshMarks(layer)
      }
      this.opts.callbacks.onLayoutReset?.(id, { layer: key, writable: true })
    }
    if (kind === "anchor") this.refreshBlocks()
  }

  /** Every shape a layer draws for a region, its outline clone included. */
  private shapesOf(regionId: string): SVGPathElement[] {
    const sel = cssEscape(regionId)
    return [...this.allLayers()].flatMap((layer) => [
      ...layer.shapes.querySelectorAll<SVGPathElement>(
        `path[data-region-id="${sel}"], path[data-outline-for="${sel}"]`,
      ),
    ])
  }

  /**
   * Every shape nudged this session, grouped by the map it was nudged on. Only the overview's
   * group belongs in `offsets.json`, which the loader applies to the national geometry.
   */
  movedRegionsJSON(): string {
    return this.movedJSON(this.movedRegions)
  }

  /**
   * Where a block is drawn now, whatever decided it — a drag, the gutter, the profile, a fact
   * or the shape's own centre — in the frame the anchors themselves are written in.
   */
  private anchorOf(layer: Layer, regionId: string): [number, number] | null {
    const seats = this.opts.seats
    const moved = this.movedAnchors.get(this.layerKey(layer))?.get(regionId)
    if (moved) return moved
    const gutter = this.gutterAnchor(layer, regionId)
    if (gutter) return gutter
    // Where the group put it. A member's own declared anchor is not consulted: in a cluster
    // the distance to the others is the point, and that only holds at one width.
    const placed = layer.clusterAnchors.get(regionId)
    if (placed) return placed
    const declared =
      toAnchor(seats?.anchors?.[regionId]) ??
      (seats?.anchorFact ? parseAnchor(this.regions.byId[regionId]?.facts[seats.anchorFact]) : null)
    if (declared) return declared
    // Before the first layout a member is drawn on the one the group hangs from, to be
    // measured; the placement that follows moves it off.
    const cluster = this.clusterOf(regionId)
    if (cluster && cluster.anchor !== regionId) return this.anchorOf(layer, cluster.anchor)
    return this.shapeAnchor(layer, regionId)
  }

  /**
   * Every anchor moved this session, grouped by the map it was moved on — which is also the
   * units, and is what stops a number measured on one map being pasted in as the other.
   * `anchors.json` itself is flat: a region's block is drawn on exactly one map.
   */
  movedAnchorsJSON(): string {
    return this.movedJSON(this.movedAnchors)
  }

  /** The map a drag happened on, as the dumps name it. */
  private layerKey(layer: Layer): string {
    return layer.parentId ?? "overview"
  }

  private movedJSON(from: Map<string, Map<string, [number, number]>>): string {
    const out: Record<string, Record<string, [number, number]>> = {}
    for (const [layer, entries] of [...from].sort(([a], [b]) => a.localeCompare(b))) {
      if (entries.size === 0) continue
      const group: Record<string, [number, number]> = {}
      for (const [id, at] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
        group[id] = [Math.round(at[0]), Math.round(at[1])]
      }
      out[layer] = group
    }
    return JSON.stringify(out, null, 2)
  }

  private remember(
    into: Map<string, Map<string, [number, number]>>,
    layer: Layer,
    regionId: string,
    at: [number, number],
  ): void {
    const key = this.layerKey(layer)
    const group = into.get(key) ?? new Map<string, [number, number]>()
    group.set(regionId, at)
    into.set(key, group)
  }

  renderBlocks(regionIds: string[]): void {
    const local = this.view.parentId ? this.locals.get(this.view.parentId) : undefined
    const target = local ?? this.overview
    this.drawBlocks(target, regionIds)
    if (local) this.drawBlocks(this.overview, [])
  }

  setSelected(regionId: string | null): void {
    this.selected = regionId
    for (const layer of this.allLayers()) {
      // A child map's own parent is its backdrop, not one of the choices on it: selecting the
      // circuit lights the seat block in its gutter, it does not flood the whole map.
      const backdrop = layer.parentId !== null && layer.parentId === regionId
      let drawn = false
      for (const p of layer.shapes.querySelectorAll<SVGPathElement>("path[data-region-id]")) {
        const covers =
          regionId !== null &&
          !(backdrop && p.getAttribute("data-role") === "parent") &&
          this.covers(layer, p, regionId)
        if (covers) {
          p.setAttribute("data-selected", "")
          drawn = true
        } else p.removeAttribute("data-selected")
      }
      // The neutral fill alone is quiet among the greys; the outline is what the eye catches.
      if (regionId !== null && drawn) {
        // Small parts already take the selected fill on the shape itself, so the selection's
        // outline is only ever the parts big enough to carry one.
        layer.selectedOverlay.setAttribute("d", this.overlayPathsFor(layer, regionId).outline)
        layer.selectedOverlay.setAttribute("data-visible", "")
      } else layer.selectedOverlay.removeAttribute("data-visible")
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
    // A region with no map of its own is read on the overview, where its children's blocks
    // are drawn, so opening one from another map is a journey back to the country.
    if (!this.hasGeometry(asset) || asset.viewBox === null) {
      this.resetCamera()
      if (this.view.parentId !== null) {
        if ((await this.drillOut()) === "cancelled") return "cancelled"
      } else {
        this.cancelMorph()
        this.detachMorphLayer()
      }
      this.view = { parentId }
      return "no-geometry"
    }
    // Where the reader is looking, before the camera is put back: the flight starts there.
    const wide = this.cameraBox(this.overview).slice()
    this.resetCamera()
    const local = this.ensureLocalLayer(parentId, asset)
    this.view = { parentId }
    this.clearHover()
    this.setSelected(null)
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
    // Primed at the reader's own view, not at the country: the plan is cached and was last
    // left wherever its previous run ended, and attaching it unprimed paints that frame.
    this.renderMorph(plan, 0, this.cameraFor(plan, 0, wide))
    this.attachMorphLayer(plan.el)
    this.setLayerState(this.overview, "hidden-hard")
    this.setLayerState(local, "hidden")
    if ((await this.runMorph(plan, true, { wide })) !== "done") return "cancelled"
    this.handoff(local, true)
    plan.el.remove()
    return "done"
  }

  /**
   * From one child map straight to another, without stopping at the country between them. The
   * shapes still travel through the overview — the two maps share no outline to morph between
   * — but the camera follows one curve through it rather than halting there.
   */
  async crossTo(
    parentId: string,
    asset: DrilldownAsset,
  ): Promise<"done" | "fallback" | "cancelled" | "no-geometry"> {
    if (this.destroyed) return "cancelled"
    const fromId = this.view.parentId
    const from = fromId ? this.locals.get(fromId) : undefined
    // Nothing to cross from, or nothing to cross to: the ordinary drill knows what to do.
    if (!fromId || !from || !this.hasGeometry(asset) || asset.viewBox === null) {
      return this.drillIn(parentId, asset)
    }
    const leaving = this.cameraBox(from).slice()
    this.resetCamera()
    const to = this.ensureLocalLayer(parentId, asset)
    const outPlan = this.morphPlanFor(fromId, from)
    const inPlan = this.morphPlanFor(parentId, to)
    if (!outPlan || !inPlan) return this.drillIn(parentId, asset)

    this.view = { parentId }
    this.clearHover()
    this.setSelected(null)
    // The reader is looking at `from`, and that is where the crossing starts.
    const outDest = this.zoomedDestOf(outPlan, leaving)
    this.renderMorph(outPlan, 1, this.cameraFor(outPlan, 1, undefined, outDest))
    this.attachMorphLayer(outPlan.el)
    this.setLayerState(this.overview, "hidden-hard")
    this.setLayerState(from, "hidden")
    this.setLayerState(to, "hidden")
    const how = await this.runCross(outPlan, inPlan, outDest)
    if (how !== "done") return "cancelled"
    this.handoff(to, true)
    outPlan.el.remove()
    inPlan.el.remove()
    return "done"
  }

  async drillOut(): Promise<"done" | "fallback" | "cancelled"> {
    const parentId = this.view.parentId
    const local = parentId ? this.locals.get(parentId) : undefined
    const leaving = local ? this.cameraBox(local).slice() : null
    this.resetCamera()
    this.view = { parentId: null }
    this.clearHover()
    this.setSelected(null)
    const plan = parentId && local ? this.morphPlanFor(parentId, local) : null
    if (!plan) {
      this.cancelMorph()
      this.detachMorphLayer()
      if (local) this.setLayerState(local, "hidden")
      this.setLayerState(this.overview, "visible")
      return "fallback"
    }
    const dest = this.zoomedDestOf(plan, leaving)
    this.renderMorph(plan, 1, this.cameraFor(plan, 1, undefined, dest))
    this.attachMorphLayer(plan.el)
    this.handoff(local!, false)
    if ((await this.runMorph(plan, false, { dest })) !== "done") return "cancelled"
    this.setLayerState(this.overview, "visible")
    plan.el.remove()
    return "done"
  }

  // ---- camera ----------------------------------------------------------------------------

  /** The layer the reader is looking at. A parent with no map of its own keeps the overview. */
  private activeLayer(): Layer {
    return (this.view.parentId ? this.locals.get(this.view.parentId) : null) ?? this.overview
  }

  /** How far in the camera is, where 1 is the whole map. */
  get zoom(): number {
    return this.camera?.k ?? 1
  }

  /** The box actually on a layer's element: its own, cut down and moved by the camera. */
  private cameraBox(layer: Layer): ViewBox {
    const cam = this.camera
    // The camera points at one map. Its numbers are in that map's units and mean nothing on
    // any other, so every layer but the one on screen answers with its own box.
    if (!cam || layer !== this.activeLayer()) return layer.render
    return cameraViewBox(cam, layer.render)
  }

  /** Put every layer's box back on its element: the one being looked at moves, the rest rest. */
  private writeCamera(): void {
    for (const layer of this.allLayers()) {
      layer.svg.setAttribute("viewBox", viewBoxAttr(this.cameraBox(layer)))
    }
    this.opts.viewport.toggleAttribute("data-zoomed", this.zoom > 1)
  }

  private cancelCameraFlight(): void {
    if (this.cameraRAF !== null) caf(this.cameraRAF)
    this.cameraRAF = null
  }

  /**
   * Move the camera. A scale change redraws the seat blocks — they are sized to come out at a
   * constant number of CSS px — and a pan does not, which keeps dragging the map cheap.
   */
  private setCamera(next: Camera | null, opts: { auto?: boolean } = {}): void {
    if (this.destroyed) return
    const was = this.zoom
    this.camera = next && next.k > 1 ? holdCamera(next, this.activeLayer().render, ZOOM_MAX) : null
    this.cameraAuto = this.camera ? (opts.auto ?? false) : false
    this.writeCamera()
    if (Math.abs(this.zoom - was) > 0.001) {
      this.refreshBlocks()
      this.opts.callbacks.onCamera?.(this.zoom)
    }
  }

  /** Fly the camera somewhere, rather than putting it there. */
  private flyCamera(to: Camera, auto: boolean): void {
    this.cancelCameraFlight()
    const layer = this.activeLayer()
    const [, , w, h] = layer.render
    const from = this.camera ?? { k: 1, cx: layer.render[0] + w / 2, cy: layer.render[1] + h / 2 }
    if (reducedMotion()) return void this.setCamera(to, { auto })
    const t0 = nowMs()
    const step = (): void => {
      const t = Math.min(1, (nowMs() - t0) / CAMERA_MS)
      const u = easeInOutCubic(t)
      this.setCamera(
        {
          k: from.k + (to.k - from.k) * u,
          cx: from.cx + (to.cx - from.cx) * u,
          cy: from.cy + (to.cy - from.cy) * u,
        },
        { auto },
      )
      this.cameraRAF = t < 1 ? raf(step) : null
    }
    step()
  }

  /** Move the map by a distance on screen, which is what an arrow key means. */
  panBy(dxPx: number, dyPx: number): void {
    const cam = this.camera
    if (!cam) return
    this.cancelCameraFlight()
    const scale = this.fitScale(this.cameraBox(this.activeLayer()))
    this.setCamera({ k: cam.k, cx: cam.cx + dxPx / scale, cy: cam.cy + dyPx / scale })
  }

  /** One press of an arrow key, in CSS px. */
  get panStep(): number {
    const { cw, ch } = this.viewportPx()
    return Math.min(cw, ch) * KEY_PAN_FRACTION
  }

  /** The whole map again. */
  resetCamera(): void {
    this.cancelCameraFlight()
    this.setCamera(null)
  }

  /** Take back a camera the map sent somewhere; leave one the reader drove there alone. */
  clearSentCamera(): void {
    if (this.cameraAuto) this.resetCamera()
  }

  /** Step in or out about a point — the pointer, or the middle of the frame — holding it still. */
  zoomBy(factor: number, about?: { x: number; y: number }): void {
    this.cancelCameraFlight()
    const layer = this.activeLayer()
    const box = this.cameraBox(layer)
    const k = this.zoom * factor
    const at = about ? this.pointIn(layer, about) : null
    const cx = box[0] + box[2] / 2
    const cy = box[1] + box[3] / 2
    if (!at) return void this.setCamera({ k, cx, cy })
    // Hold `at` still: the fraction of the frame it sits at now is the fraction it keeps.
    const fx = (at[0] - box[0]) / box[2]
    const fy = (at[1] - box[1]) / box[3]
    const [, , w, h] = layer.render
    this.setCamera({ k, cx: at[0] + (0.5 - fx) * (w / k), cy: at[1] + (0.5 - fy) * (h / k) })
  }

  /** A client point in a layer's drawn units, or null when the map is not on screen. */
  private pointIn(layer: Layer, at: { x: number; y: number }): [number, number] | null {
    const rect = layer.svg.getBoundingClientRect()
    if (!(rect.width > 0 && rect.height > 0)) return null
    const box = this.cameraBox(layer)
    // The svg element is the viewport, and the box letterboxes inside it.
    const scale = Math.min(rect.width / box[2], rect.height / box[3])
    const left = rect.left + (rect.width - box[2] * scale) / 2
    const top = rect.top + (rect.height - box[3] * scale) / 2
    return [box[0] + (at.x - left) / scale, box[1] + (at.y - top) / scale]
  }

  /** Whether the map on screen draws this region at all, or only its seat block. */
  drawsShape(regionId: string): boolean {
    const layer = this.activeLayer()
    return layer.shapes.querySelector(`path[data-region-id="${cssEscape(regionId)}"]`) !== null
  }

  /**
   * Send the camera to a region's seat block, or to the whole group's when it belongs to one.
   * For a court with no territory that block is the only thing that answers "where is it".
   * The blocks do not grow with the zoom, so what changes is how much country is behind them.
   */
  focusOn(regionId: string, k: number = FOCUS_ZOOM): void {
    const layer = this.activeLayer()
    const ids = this.clusterOf(regionId)?.rows.flat() ?? [regionId]
    const at = this.blockCentre(layer, ids)
    if (!at) return
    this.flyCamera({ k, cx: at[0], cy: at[1] }, true)
  }

  /**
   * The middle of what a set of seat blocks covers, in the layer's drawn units. Four numbers
   * and not a `DOMRect`: not every engine fills in `right`/`bottom`, and a union of those
   * came out `NaN`.
   */
  private blockCentre(layer: Layer, regionIds: string[]): [number, number] | null {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const id of regionIds) {
      const block = layer.annotations.querySelector<SVGGElement>(
        `g[data-drilldown-block][data-region-id="${cssEscape(id)}"]`,
      )
      const bb = block?.getBBox()
      if (!bb || !(bb.width > 0 && bb.height > 0)) continue
      x0 = Math.min(x0, bb.x)
      y0 = Math.min(y0, bb.y)
      x1 = Math.max(x1, bb.x + bb.width)
      y1 = Math.max(y1, bb.y + bb.height)
    }
    return Number.isFinite(x0) ? [(x0 + x1) / 2, (y0 + y1) / 2] : null
  }

  // ---- layers --------------------------------------------------------------------------------

  private allLayers(): Layer[] {
    return [this.overview, ...this.locals.values()]
  }

  private adopt(
    el: HTMLElement,
    svg: SVGSVGElement,
    viewBox: ViewBox,
    render: { vb: ViewBox; gutter: number },
    flipY: boolean,
    parentId: string | null,
  ): Layer {
    const shapes = svg.querySelector<SVGGElement>("g[data-drilldown-shapes]")
    const annotations = svg.querySelector<SVGGElement>("g[data-drilldown-annotations]")
    if (!shapes || !annotations) throw new Error("drilldown stage: layer svg is missing its groups")
    svg.querySelectorAll("path[data-drilldown-overlay]").forEach((n) => n.remove())
    // Selection underneath: a hovered selected region reads as hovered, not as two lines.
    const selectedOverlay = svgEl("path", { "data-drilldown-overlay": "selected", d: "" })
    // Islands too small to carry a stroke are filled instead; under the stroked overlay, so a
    // region with both reads as one mark.
    const overlayTiny = svgEl("path", { "data-drilldown-overlay": "tiny", d: "" })
    const overlay = svgEl("path", { "data-drilldown-overlay": "", d: "" })
    shapes.append(selectedOverlay, overlayTiny, overlay)
    const layer: Layer = {
      el,
      svg,
      shapes,
      annotations,
      overlay,
      overlayTiny,
      selectedOverlay,
      viewBox,
      render: render.vb,
      gutter: render.gutter,
      clusterAnchors: new Map(),
      flipY,
      parentId,
    }
    // Only now is there a handler behind the shapes, so only now do they advertise as buttons.
    for (const p of shapes.querySelectorAll<SVGPathElement>("path[data-region-id]")) {
      if (this.targetOf(layer, p)) p.setAttribute("role", "button")
    }
    return layer
  }

  /** The viewport in CSS px, falling back to a nominal square while it is unmeasurable. */
  private viewportPx(): { cw: number; ch: number } {
    return {
      cw: this.opts.viewport.clientWidth || NOMINAL_MAP_PX,
      ch: this.opts.viewport.clientHeight || NOMINAL_MAP_PX,
    }
  }

  /** Rendered px a region's block takes across, margins included. Owes nothing to the projection. */
  private blockWidthPx(regionId: string): number {
    const seats = this.opts.seats
    const region = this.regions.byId[regionId]
    if (!seats || !region) return 0
    const total = Number(region.facts[seats.totalFact])
    if (!Number.isFinite(total) || total <= 0) return 0
    const compact = this.viewportPx().cw < COMPACT_MAP_PX
    const e = compact ? BLOCK_PX_COMPACT : BLOCK_PX
    const pitch = e * (1 + BLOCK_GAP)
    const cols = Math.ceil(total / BLOCK_ROWS)
    const label = !compact && seats.labelFact ? e * 3.2 : 0
    return Math.max(cols * pitch - (pitch - e), label) + 2 * PARENT_GUTTER_MARGIN_PX
  }

  /**
   * A child map reserves a gutter down its left for the parent's own seat block. The map is
   * letterboxed into what is left, so the reservation solves for the shrink it causes:
   * widening the viewBox scales the map down, which would otherwise eat the room it made.
   */
  private renderBox(raw: ViewBox, parentId: string | null): { vb: ViewBox; gutter: number } {
    const [px, py, pw, ph] = padViewBox(raw)
    const topPad = CHILD_TOP_PAD_FRACTION * ph
    const vb: ViewBox = [px, py - topPad, pw, ph + topPad]
    const need = parentId ? this.blockWidthPx(parentId) : 0
    if (need <= 0) return { vb, gutter: 0 }
    const { cw, ch } = this.viewportPx()
    const [x, y, w, h] = vb
    // Height-bound: the scale is fixed by the height, so the px convert straight to units.
    let gutter = (need * h) / ch
    // Width-bound: every unit added shrinks the scale, hence the solve for g.
    if ((w + gutter) * (ch / h) > cw) gutter = need < cw ? (need * w) / (cw - need) : w
    return { vb: [x - gutter, y, w + gutter, h], gutter }
  }

  private buildLocalLayer(parentId: string, asset: DrilldownAsset): Layer {
    const raw = asset.viewBox!
    const render = this.renderBox(raw, parentId)
    const vb = render.vb
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
    const layer = this.adopt(el, svg, raw, render, asset.flipY, parentId)
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

  /**
   * Whether this path is part of how the layer draws `regionId`, which is a different question
   * on each map. On the overview an inset stands in for its parent (Alaska for the 9th) and is
   * painted with it; on the circuit's own map it is a district in its own right.
   */
  private covers(layer: Layer, path: SVGPathElement, regionId: string): boolean {
    if (path.getAttribute("data-region-id") === regionId) return true
    return (
      layer.parentId === null &&
      path.getAttribute("data-inset") === "true" &&
      path.getAttribute("data-parent-id") === regionId &&
      path.getAttribute("data-role") === "child"
    )
  }

  /**
   * A parent's outline is mainland-only, so its hover mark adds every inset that points at it
   * — split per subpath, not per shape. The 2px stroke does not scale, and on five pixels of
   * Virgin Islands it closes over the island and reads as a blot, so those take a fill instead.
   */
  private overlayPathsFor(layer: Layer, regionId: string): { outline: string; tiny: string } {
    const scale = this.fitScale(this.cameraBox(layer))
    const outline: string[] = []
    const tiny: string[] = []
    for (const p of layer.shapes.querySelectorAll<SVGPathElement>(
      `path[data-region-id][data-role]:not([data-role="outline"])`,
    )) {
      if (!this.covers(layer, p, regionId)) continue
      const d = p.getAttribute("d") ?? ""
      const subs = parsePathAbs(d)
      // The contract says absolute M/L; a shape that somehow is not gets outlined whole.
      if (!subs) {
        outline.push(d)
        continue
      }
      // A shape nudged with the layout tools carries its move as a transform, not in its
      // coordinates — which is what the mark is built from.
      const nudged = this.movedRegions
        .get(this.layerKey(layer))
        ?.get(p.getAttribute("data-region-id") ?? "")
      if (nudged) {
        for (const sub of subs) {
          for (let i = 0; i < sub.length; i += 2) {
            sub[i] = sub[i]! + nudged[0]
            sub[i + 1] = sub[i + 1]! + nudged[1]
          }
        }
      }
      for (const sub of subs) {
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        for (let i = 0; i < sub.length; i += 2) {
          const x = sub[i]!
          const y = sub[i + 1]!
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
        const px = Math.max(x1 - x0, y1 - y0) * scale
        ;(px < OUTLINE_MIN_PX ? tiny : outline).push(serializePath([sub]))
      }
    }
    return { outline: outline.join(" "), tiny: tiny.join(" ") }
  }

  private cancelPendingHover(): void {
    if (!this.pendingHover) return
    clearTimeout(this.pendingHover.timer)
    this.pendingHover = null
  }

  /**
   * Ends a hover outright — a drill transition's own reset, not a pointer leaving. Clears
   * `hovered` itself, not only the pending timer and the tooltip callback: a transition that
   * only told the tooltip `(null, null)` left `hovered` naming the region just left behind, and
   * `setSelected`'s `highlightBlocks` call right after read that stale id back — lighting the
   * hover glow on whatever block shares it in the map just arrived at (the parent's own gutter
   * block is exactly that, on every drill-in). Called before `setSelected`, so that read sees
   * the reset.
   */
  private clearHover(): void {
    this.cancelPendingHover()
    this.hovered = null
    this.opts.callbacks.onHover(null, null)
  }

  /**
   * Route a pointer's idea of the target through the forgiveness delay. Landing back on the
   * region already highlighted cancels a pending change outright.
   */
  private requestHover(
    layer: Layer,
    regionId: string | null,
    point: { x: number; y: number } | null,
  ): void {
    if (regionId === this.hovered) {
      this.cancelPendingHover()
      return
    }
    // Nothing is highlighted yet, so there is no flicker to forgive: light up at once.
    if (regionId !== null && this.hovered === null) {
      this.cancelPendingHover()
      this.setHover(layer, regionId, point)
      return
    }
    if (this.pendingHover?.id === regionId) {
      // Same pending target, fresher cursor — let the timer run out rather than restarting it.
      this.pendingHover.point = point
      return
    }
    this.cancelPendingHover()
    const delay = regionId === null ? HOVER_CLEAR_MS : HOVER_SWITCH_MS
    const timer = setTimeout(() => {
      const pending = this.pendingHover
      this.pendingHover = null
      if (this.destroyed || !pending) return
      this.setHover(layer, pending.id, pending.point)
    }, delay)
    this.pendingHover = { id: regionId, point, timer }
  }

  private setHover(
    layer: Layer,
    regionId: string | null,
    point: { x: number; y: number } | null,
  ): void {
    this.cancelPendingHover()
    if (regionId) {
      const marks = this.overlayPathsFor(layer, regionId)
      layer.overlay.setAttribute("d", marks.outline)
      layer.overlayTiny.setAttribute("d", marks.tiny)
      layer.overlay.setAttribute("data-visible", "")
      layer.overlayTiny.setAttribute("data-visible", "")
    } else {
      layer.overlay.removeAttribute("data-visible")
      layer.overlayTiny.removeAttribute("data-visible")
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
      if (id || this.hovered) {
        this.requestHover(layer, id, id ? { x: e.clientX, y: e.clientY } : null)
      }
    }
    const onMove = (e: PointerEvent): void => {
      const point = { x: e.clientX, y: e.clientY }
      // Whatever is queued should arrive under the cursor, not where it was 80 ms ago.
      if (this.pendingHover?.id) this.pendingHover.point = point
      if (this.hovered) this.opts.callbacks.onHover(this.hovered, point)
    }
    // The pointer has left the map altogether — unambiguous, so no grace period.
    const onLeave = (): void => {
      this.cancelPendingHover()
      if (this.hovered) this.setHover(layer, null, null)
    }
    const onClick = (e: MouseEvent): void => {
      if (this.suppressClick) return
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
      if (this.hovered === id) return
      const r = path.getBoundingClientRect()
      this.setHover(layer, id, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    const onBlur = (): void => {
      this.cancelPendingHover()
      if (this.hovered) this.setHover(layer, null, null)
    }

    /**
     * Dragging a region's shapes, the other half of the same tool: nudge one, and the offset
     * it takes is printed for `geometry/offsets.json`, which the loader applies over the
     * export. The whole region moves, outline clone and all.
     */
    const onRegionDown = (e: PointerEvent): void => {
      const path = pathFrom(e.target)
      const id = path?.getAttribute("data-region-id")
      if (!path || !id) return
      e.preventDefault()
      e.stopPropagation()
      // Everything drawn at this outline, not merely the path under the pointer.
      const ids = this.coincidentIds(layer, path.getAttribute("d"))
      if (this.isDoublePress(layer, id)) return void this.resetLayout(layer, ids, "region")
      const shapes = ids.flatMap((each) => this.shapesOf(each))
      const scale = this.fitScale(this.cameraBox(layer))
      // A file's coordinates are unflipped; the group they are drawn in carries the flip.
      const flip = layer.flipY ? -1 : 1
      const startX = e.clientX
      const startY = e.clientY
      const had = this.movedRegions.get(this.layerKey(layer))?.get(id) ?? [0, 0]
      // The transform goes on a path *inside* the flipped group, so the file's own units are
      // already the right ones to move it by — flipping again sends the shape the wrong way.
      const offsetAt = (ev: PointerEvent): [number, number] => [
        had[0] + (ev.clientX - startX) / scale,
        had[1] + ((ev.clientY - startY) / scale) * flip,
      ]
      const move = (ev: PointerEvent): void => {
        const [x, y] = offsetAt(ev)
        shapes.forEach((p) => p.setAttribute("transform", `translate(${x} ${y})`))
        for (const each of ids) this.remember(this.movedRegions, layer, each, [x, y])
        this.refreshMarks(layer)
      }
      const up = (ev: PointerEvent): void => {
        svg.removeEventListener("pointermove", move)
        svg.removeEventListener("pointerup", up)
        svg.removeEventListener("pointercancel", up)
        const by = offsetAt(ev)
        move(ev)
        // One line per region: two stacked shapes are still two paths in the file.
        for (const each of ids) {
          this.remember(this.movedRegions, layer, each, by)
          this.opts.callbacks.onRegionMoved?.(each, [Math.round(by[0]), Math.round(by[1])], {
            layer: this.layerKey(layer),
            // `offsets.json` is applied to the national geometry, so that is the only map a
            // nudge can be written down for.
            writable: layer.parentId === null,
          })
        }
      }
      svg.setPointerCapture(e.pointerId)
      svg.addEventListener("pointermove", move)
      svg.addEventListener("pointerup", up)
      svg.addEventListener("pointercancel", up)
    }

    /**
     * Dragging the map itself, once there is more of it than the frame holds. The same press
     * chooses a region, so the two are told apart by how far the pointer travels; past the
     * slop it is a pan, and the click it would have been is dropped.
     */
    const onPanDown = (e: PointerEvent): void => {
      if (this.layoutEditing || e.button !== 0 || this.zoom <= 1) return
      const startX = e.clientX
      const startY = e.clientY
      const from = this.camera
      if (!from) return
      let panning = false
      const move = (ev: PointerEvent): void => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!panning && Math.hypot(dx, dy) < PAN_SLOP) return
        if (!panning) {
          panning = true
          this.cancelCameraFlight()
          this.cancelPendingHover()
          if (this.hovered) this.setHover(layer, null, null)
          this.opts.viewport.setAttribute("data-panning", "")
        }
        const scale = this.fitScale(this.cameraBox(layer))
        this.setCamera({ k: from.k, cx: from.cx - dx / scale, cy: from.cy - dy / scale })
      }
      const up = (): void => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        window.removeEventListener("pointercancel", up)
        this.opts.viewport.removeAttribute("data-panning")
        if (!panning) return
        // The click is dispatched straight after this, so the flag has to outlive the gesture
        // by exactly one turn of the event loop and no longer.
        this.suppressClick = true
        setTimeout(() => (this.suppressClick = false), 0)
      }
      // On the window rather than captured on the map: a capture retargets the click that
      // follows to whatever holds it, which stops a press choosing the region under it.
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      window.addEventListener("pointercancel", up)
    }

    /**
     * Dragging a block, when an editor has asked for it. The map's own hover and click run on
     * the same element, so this claims the pointer outright: capture, stop the event, and put
     * the anchor back where the pointer says once it is released.
     */
    const onBlockDown = (e: PointerEvent): void => {
      if (!this.layoutEditing) return void onPanDown(e)
      const block = blockFrom(e.target)
      if (!block) return void onRegionDown(e)
      const pressed = block.getAttribute("data-region-id")
      if (!pressed) return
      // A cluster is spaced in px and hung from one member, so the group travels and the
      // number that comes out is the anchor member's.
      const id = this.dragTarget(pressed)
      const from = this.anchorOf(layer, id)
      if (!from) return
      e.preventDefault()
      e.stopPropagation()
      if (this.isDoublePress(layer, pressed)) return void this.resetLayout(layer, [id], "anchor")
      const moving = this.clusterOf(pressed)
        ? [...layer.annotations.querySelectorAll<SVGGElement>("g[data-drilldown-block]")].filter(
            (g) => this.dragTarget(g.getAttribute("data-region-id") ?? "") === id,
          )
        : [block]
      const scale = this.fitScale(this.cameraBox(layer))
      const startX = e.clientX
      const startY = e.clientY
      // A block is placed in geographic Y on a flipped layer, so what the pointer does
      // downwards is the opposite of what the number does.
      const flip = layer.flipY ? -1 : 1
      const move = (ev: PointerEvent): void => {
        const dx = (ev.clientX - startX) / scale
        const dy = (ev.clientY - startY) / scale
        for (const g of moving) g.setAttribute("transform", `translate(${dx} ${dy})`)
      }
      const up = (ev: PointerEvent): void => {
        svg.removeEventListener("pointermove", move)
        svg.removeEventListener("pointerup", up)
        svg.removeEventListener("pointercancel", up)
        for (const g of moving) g.removeAttribute("transform")
        const at: [number, number] = [
          from[0] + (ev.clientX - startX) / scale,
          from[1] + ((ev.clientY - startY) / scale) * flip,
        ]
        // Read before remembering, or the check sees the drag it is being asked about.
        const gutter = this.gutterAnchor(layer, id) !== null
        this.remember(this.movedAnchors, layer, id, at)
        this.opts.callbacks.onAnchorMoved?.(id, [Math.round(at[0]), Math.round(at[1])], {
          layer: this.layerKey(layer),
          // A circuit's block on its own map sits in the gutter, placed from the map's box.
          // Dragging it moves it for the session; `anchors.json` has no say over it.
          writable: !gutter,
        })
        this.refreshBlocks()
      }
      svg.setPointerCapture(e.pointerId)
      svg.addEventListener("pointermove", move)
      svg.addEventListener("pointerup", up)
      svg.addEventListener("pointercancel", up)
    }

    /**
     * The wheel zooms about the pointer, which is what a reader expects of a map.
     *
     * A gesture that cannot change anything is handed back to the page — scrolling out at the
     * whole map, or in at the limit — so a reader passing the map on their way down the page is
     * never held by it. `ctrl`/`⌘` is the trackpad's pinch and the browser's own page zoom, so
     * it is always taken: over a map, pinching means the map.
     */
    const onWheel = (e: WheelEvent): void => {
      if (this.layoutEditing || e.deltaY === 0) return
      const pinch = e.ctrlKey || e.metaKey
      const inward = e.deltaY < 0
      if (!pinch && ((inward && this.zoom >= ZOOM_MAX) || (!inward && this.zoom <= 1))) return
      e.preventDefault()
      const px = wheelPx(e, this.viewportPx().ch)
      this.zoomBy(Math.exp(-px * WHEEL_ZOOM_RATE), { x: e.clientX, y: e.clientY })
    }

    svg.addEventListener("pointerdown", onBlockDown)
    // Not passive: the whole point is to keep the page from scrolling under the gesture.
    svg.addEventListener("wheel", onWheel, { passive: false })
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
      svg.removeEventListener("pointerdown", onBlockDown)
      svg.removeEventListener("wheel", onWheel)
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
    const [, , vw, vh] = this.cameraBox(layer)
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

  /**
   * Where a child map draws its own parent: centred in the gutter reserved for it, level with
   * the middle of the map. Its declared anchor is no use here — that one is in the overview's
   * units, and points at the region's place among its siblings on a map this is not.
   */
  private gutterAnchor(layer: Layer, regionId: string): [number, number] | null {
    if (!layer.gutter || regionId !== layer.parentId) return null
    const [x, y, , h] = layer.render
    // drawBlocks reads an anchor as geographic Y and flips it, so hand back the flip's inverse.
    const middle = y + h / 2
    return [x + layer.gutter / 2, layer.flipY ? flipConstant(layer.viewBox) - middle : middle]
  }

  private drawBlocks(layer: Layer, regionIds: string[]): void {
    const seats = this.opts.seats
    const existing = layer.annotations.querySelector("g[data-drilldown-blocks]")
    if (!seats || regionIds.length === 0) {
      existing?.remove()
      return
    }
    // Everything that decides what these blocks look like. Redrawing tears down and rebuilds
    // every square, so doing it when nothing has changed flashes the map's furniture.
    const signature = [
      regionIds.map((id) => `${id}:${this.regions.byId[id]?.facts[seats.totalFact] ?? ""}`).join(),
      Math.round(this.renderedWidth(layer)),
      Math.round(layer.gutter),
      layer.render.join(),
      // The zoom, and deliberately not the pan: dragging the map does not change its size.
      Math.round(this.zoom * 100),
      [...(this.movedAnchors.get(this.layerKey(layer)) ?? [])].map(
        ([id, at]) => `${id}@${Math.round(at[0])},${Math.round(at[1])}`,
      ),
    ].join("|")
    if (existing?.getAttribute("data-signature") === signature) {
      // Hover and selection are written onto the blocks that are already there.
      this.highlightBlocks(layer)
      return
    }
    existing?.remove()
    const group = svgEl("g", { "data-drilldown-blocks": "", "data-signature": signature })
    const [, , vw] = this.cameraBox(layer)
    // The gutter only widens the box to the left, so the Y flip is the raw one either way.
    const k = flipConstant(layer.viewBox)
    const rendered = this.renderedWidth(layer)
    // Compactness follows the room the page gives the map, not the rendered width: a tall
    // child map letterboxes narrow on a wide screen and still has room for full-size blocks.
    const compact = (this.opts.viewport.clientWidth || rendered) < COMPACT_MAP_PX
    if (compact) layer.svg.setAttribute("data-drilldown-compact", "")
    else layer.svg.removeAttribute("data-drilldown-compact")
    const unitsPerPx = vw / rendered
    const e = (compact ? BLOCK_PX_COMPACT : BLOCK_PX) * unitsPerPx
    const pitch = e * (1 + BLOCK_GAP)

    const ctx: BlockContext = { seats, compact, e, pitch, unitsPerPx, k }
    for (const id of regionIds) {
      const block = this.buildBlock(layer, id, ctx)
      if (block) group.appendChild(block)
    }
    layer.annotations.appendChild(group)
    this.cutPlinths(group)
    // Only now is a block's real size known, so this is where a cluster places its members.
    // Doing so rebuilds them, which is a new set of plinths to cut.
    if (this.placeClusters(layer, group, regionIds, ctx)) this.cutPlinths(group)
    this.blocksGen++
    this.highlightBlocks(layer)
  }

  /**
   * Cut each plinth to what its block actually holds: the label's width is the browser's to
   * know, and "SCOTUS" is twice the guess the box is built with. `contentBounds` ignores the
   * plinth and the hit rect, so running this twice says what running it once did.
   */
  private cutPlinths(group: SVGGElement): void {
    for (const plinth of group.querySelectorAll<SVGRectElement>("rect[data-block-plinth]")) {
      const box = contentBounds(plinth.parentElement)
      if (!box) continue
      const pad = Number(plinth.getAttribute("rx")) || 0
      plinth.setAttribute("x", String(box.x - pad))
      plinth.setAttribute("y", String(box.y - pad))
      plinth.setAttribute("width", String(box.width + pad * 2))
      plinth.setAttribute("height", String(box.height + pad * 2))
    }
  }

  /**
   * One region's seat block, built at whatever `anchorOf` says its place is. Everything its
   * size depends on is in `ctx`, so one block can be rebuilt on its own — which is how a
   * cluster places its members once it has measured how big they came out.
   */
  private buildBlock(layer: Layer, id: string, ctx: BlockContext): SVGGElement | null {
    const { seats, compact, e, pitch, unitsPerPx, k } = ctx
    const region = this.regions.byId[id]
    if (!region) return null
    const total = Number(region.facts[seats.totalFact])
    if (!Number.isFinite(total) || total <= 0) return null
    const squares: { color: string | null }[] = []
    for (const g of seats.groups) {
      const n = Number(region.facts[g.fact])
      for (let i = 0; i < (Number.isFinite(n) ? n : 0); i++) squares.push({ color: g.color })
    }
    // Size to whichever is larger so no member is ever dropped from the block.
    while (squares.length < total) squares.push({ color: null })
    const anchor = this.anchorOf(layer, id)
    if (!anchor) return null
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
    const box = {
      x: x0 - m,
      y: top - m * 0.5,
      width: Math.max(wide, labelText ? e * 3.2 : 0) + 2 * m,
      height: y0 + tall + m - (top - m * 0.5),
    }
    // A court with no territory on this map has nothing to be drawn on, so its block would
    // read as an annotation floating in the sea. This gives it the same fill and edge every
    // region has, cut to the block it holds.
    if (!layer.shapes.querySelector(`path[data-region-id="${cssEscape(id)}"]`)) {
      block.appendChild(
        svgEl("rect", {
          "data-block-plinth": "",
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rx: e * 0.35,
        }),
      )
    }
    block.appendChild(svgEl("rect", { "data-block-hit": "", ...box }))
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
    return block
  }

  /** Which cluster a block belongs to. At most one — the first mention is the one that counts. */
  private clusterOf(regionId: string): SeatCluster | null {
    for (const cluster of this.opts.seats?.clusters ?? [])
      if (cluster.rows.some((row) => row.includes(regionId))) return cluster
    return null
  }

  /** The block a drag on this one moves: a cluster travels whole, from its anchor member. */
  private dragTarget(regionId: string): string {
    return this.clusterOf(regionId)?.anchor ?? regionId
  }

  /**
   * Place each cluster's members against each other, and answer whether anything moved. It
   * runs on blocks already drawn because a block's size is not knowable before then — a plinth
   * is cut to a caption the browser measures. The layout is a function of one position and the
   * measured sizes, never of where the members happen to be sitting, so it is stable.
   */
  private placeClusters(
    layer: Layer,
    group: SVGGElement,
    regionIds: string[],
    ctx: BlockContext,
  ): boolean {
    const clusters = this.opts.seats?.clusters
    if (!clusters?.length) return false
    const drawn = new Set(regionIds)
    const blockOf = (id: string): SVGGElement | null =>
      group.querySelector<SVGGElement>(`g[data-drilldown-block][data-region-id="${cssEscape(id)}"]`)
    // A block is placed by its anchor and drawn as a box around it; this is the difference
    // between the two, and it does not change when the block moves.
    const screenY = (at: readonly number[]): number => (layer.flipY ? ctx.k - at[1]! : at[1]!)
    let moved = false
    for (const cluster of clusters) {
      const origin = cluster.anchor
      const originAt = this.anchorOf(layer, origin)
      if (!drawn.has(origin) || !originAt) continue
      const boxes = new Map<string, { box: ClusterBox; offX: number; offY: number }>()
      for (const id of cluster.rows.flat()) {
        const el = drawn.has(id) ? blockOf(id) : null
        const at = el ? this.anchorOf(layer, id) : null
        if (!el || !at) continue
        const bb = el.getBBox()
        if (!(bb.width > 0 && bb.height > 0)) continue
        boxes.set(id, {
          box: { id, width: bb.width, height: bb.height },
          offX: bb.x - at[0]!,
          offY: bb.y - screenY(at),
        })
      }
      const anchorBox = boxes.get(origin)
      if (!anchorBox) continue
      const gap = (cluster.gap ?? CLUSTER_GAP_PX) * ctx.unitsPerPx
      const placement = layoutCluster(
        cluster.rows.map((row) => row.flatMap((id) => boxes.get(id)?.box ?? [])),
        {
          gap,
          rowGap: (cluster.rowGap ?? cluster.gap ?? CLUSTER_GAP_PX) * ctx.unitsPerPx,
          align: cluster.align ?? "center",
        },
      )
      // Where the group hangs from the anchor member's own declared position.
      const home = placement.at.get(origin)
      if (!home) continue
      const rawX = originAt[0]! - (home[0] - anchorBox.offX)
      const rawY = screenY(originAt) - (home[1] - anchorBox.offY)
      // Pulled back inside the frame if the anchor would otherwise push the group off it. A
      // clamp of zero range (the group is wider than the frame has room for) leaves it at the
      // near edge rather than folding it inside out.
      const [rx, ry, rw, rh] = layer.render
      const margin = (cluster.edgeMargin ?? CLUSTER_INSET_PX) * ctx.unitsPerPx
      const clamp = (v: number, lo: number, hi: number): number =>
        Math.min(Math.max(v, lo), Math.max(lo, hi))
      const groupX = clamp(rawX, rx + margin, rx + rw - margin - placement.width)
      const groupY = clamp(rawY, ry + margin, ry + rh - margin - placement.height)
      for (const [id, at] of placement.at) {
        const entry = boxes.get(id)
        const was = this.anchorOf(layer, id)
        if (!entry || !was) continue
        const x = at[0] - entry.offX + groupX
        const y = at[1] - entry.offY + groupY
        const to: [number, number] = [x, layer.flipY ? ctx.k - y : y]
        const still = CLUSTER_EPSILON_PX * ctx.unitsPerPx
        if (Math.abs(to[0] - was[0]!) < still && Math.abs(to[1] - was[1]!) < still) continue
        layer.clusterAnchors.set(id, to)
        const rebuilt = this.buildBlock(layer, id, ctx)
        if (rebuilt) blockOf(id)?.replaceWith(rebuilt)
        moved = true
      }
    }
    return moved
  }

  private refreshBlocks(): void {
    if (this.destroyed) return
    // The gutter is sized in rendered px, so a resize re-cuts it before the blocks redraw.
    for (const layer of this.locals.values()) {
      if (!layer.parentId) continue
      const render = this.renderBox(layer.viewBox, layer.parentId)
      if (viewBoxAttr(render.vb) === viewBoxAttr(layer.render)) continue
      layer.render = render.vb
      layer.gutter = render.gutter
      layer.svg.setAttribute("viewBox", viewBoxAttr(this.cameraBox(layer)))
    }
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
    // Nothing else a plan holds is measured in pixels, so a running morph picks the new
    // blocks up rather than the cache being thrown away.
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
      // A child map's own parent sits in the gutter and is selected the whole time the
      // reader is on that map, so the swell says nothing there. The stroke still marks it.
      const stuck = id !== null && id === layer.parentId
      this.animateBlockScale(
        block,
        selected && !stuck ? BLOCK_SCALE_SELECTED : hovered ? BLOCK_SCALE_HOVER : 1,
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
    const svg = svgEl("svg", {
      "data-drilldown-morph": "",
      viewBox: viewBoxAttr(vbStart),
      preserveAspectRatio: "xMidYMid meet",
      overflow: "visible",
      "aria-hidden": "true",
    })
    // Fading elements are grouped so the opacity lives on the group: opacity < 1 forces a
    // transparency layer the size of the element's bounds, and ~100 of them per morph dragged.
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
    // Seat blocks belong to one view and live in unflipped annotation coordinates, so they
    // crossfade too, riding the interpolating viewBox glued to their own map.
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
    // The same shapes measured in both files: the two are projected separately, and this is
    // the only thing that says where one frame sits inside the other.
    const contentFrom = subpathBounds(pairs.map((pr) => pr.start))
    const contentTo = subpathBounds(pairs.map((pr) => pr.end))
    if (!contentFrom || !contentTo) return null
    return {
      el,
      svg,
      pairs,
      vbStart,
      layer: local,
      contentFrom,
      contentTo,
      blocksOut,
      blocksIn,
      blocksGen: this.blocksGen,
      fadeOut: [shapesOut, blocksOut],
      fadeIn: [shapesIn, blocksIn],
    }
  }

  /** Where the camera sits at `u` of a plan's morph, in the frame the drawing has reached. */
  private cameraFor(
    plan: MorphPlan,
    u: number,
    // Both ends of the flight, in the overview's coordinates. The defaults are the whole
    // country and the whole child map, which is what a transition between two unzoomed views
    // travels between; a reader who has moved the camera hands in where they actually are.
    //
    // `layer.render` is read every frame rather than captured: a child's gutter is solved
    // against the viewport's width, which the side panels change while the morph is running,
    // and a captured target would land a few pixels off the layer it hands over to.
    wide: readonly number[] = plan.vbStart,
    dest: readonly number[] = this.destOf(plan),
  ): number[] {
    // The content tracker rides the same rate as the camera's own zoom (`f`), not raw `u`:
    // on raw `u` the two drifted apart mid-flight — the camera's geometric zoom (correctly)
    // outran a linear `u`, and the content correction, still on `u`, fell behind the camera's
    // own pan, so the frame spent most of the flight zoomed in on a point that hadn't yet
    // caught up to the destination.
    const f = zoomProgress(wide[2]!, dest[2]!, u)
    return frameForContent(zoomViewBox(wide, dest, u), plan.contentFrom, plan.contentTo, f)
  }

  /** A plan's own destination in the overview's coordinates, which is where a flight aims. */
  private destOf(plan: MorphPlan): number[] {
    return pullbackViewBox(plan.layer.render, plan.contentFrom, plan.contentTo)
  }

  /**
   * A child map's end of a flight, cut down to what the reader is actually looking at.
   *
   * The camera is put back to the whole map before a transition — the blocks have to be
   * redrawn at one scale, and the plan's clones taken at that scale — but where the reader was
   * is still where the movement should begin. Without this, choosing a circuit from a map
   * zoomed twice snapped out to the whole country and only then flew in.
   */
  private zoomedDestOf(plan: MorphPlan, box: readonly number[] | null): number[] | undefined {
    return box ? pullbackViewBox(box, plan.contentFrom, plan.contentTo) : undefined
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
    // Reset to the country, transforms and all, so an unprimed plan never paints a stale frame.
    if (plan) this.renderMorph(plan, 0, this.cameraFor(plan, 0))
    return plan
  }

  private setFades(plan: MorphPlan, u: number): void {
    for (const n of plan.fadeOut) n.style.opacity = String(1 - u)
    for (const n of plan.fadeIn) n.style.opacity = String(u)
  }

  /**
   * Take the block groups again if either layer has redrawn its own since the plan was built.
   * A block's size runs off the viewport's width, which the side panels change while a
   * transition is running, and the clone would hand over to blocks of a different size.
   */
  private syncPlanBlocks(plan: MorphPlan): void {
    if (plan.blocksGen === this.blocksGen) return
    plan.blocksGen = this.blocksGen
    for (const [src, into] of [
      [this.overview, plan.blocksOut],
      [plan.layer, plan.blocksIn],
    ] as const) {
      into.replaceChildren()
      const blocks = src.annotations.querySelector("g[data-drilldown-blocks]")
      if (blocks) into.appendChild(blocks.cloneNode(true))
    }
  }

  /** The px-per-unit a viewBox letterboxes to in the current viewport — SVG's own `meet`. */
  private fitScale(vb: readonly number[]): number {
    const { cw, ch } = this.viewportPx()
    const [, , w, h] = vb as [number, number, number, number]
    return w > 0 && h > 0 ? Math.min(cw / w, ch / h) : 1
  }

  /**
   * Hold a group's seat blocks at the size they were drawn to be, whatever the camera is doing.
   * A block is sized in map units to come out at a fixed number of CSS px on its own map, and
   * a morph crosses a fivefold zoom away from that. Scaled about its own centre, so only the
   * size moves.
   */
  private sizeBlocks(group: SVGGElement, factor: number): void {
    const near = !Number.isFinite(factor) || Math.abs(factor - 1) < 0.002
    for (const block of group.querySelectorAll<SVGGElement>("g[data-drilldown-block]")) {
      if (near) {
        block.removeAttribute("transform")
        continue
      }
      // The hit rect spans the block, so its middle is the block's — and it is plain attribute
      // arithmetic, which a layer that has never been laid out can still answer.
      const hit = block.querySelector("rect[data-block-hit]")
      if (!hit) continue
      const cx = Number(hit.getAttribute("x")) + Number(hit.getAttribute("width")) / 2
      const cy = Number(hit.getAttribute("y")) + Number(hit.getAttribute("height")) / 2
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue
      block.setAttribute(
        "transform",
        `translate(${cx} ${cy}) scale(${factor}) translate(${-cx} ${-cy})`,
      )
    }
  }

  private renderMorph(plan: MorphPlan, u: number, vb: readonly number[]): void {
    this.syncPlanBlocks(plan)
    for (const pr of plan.pairs) {
      lerpInto(pr.start, pr.end, pr.work, u)
      pr.node.setAttribute("d", serializePath(pr.work))
    }
    // The paired shapes define the frame; each file's own shapes and blocks are a whole
    // projection away from it, so they are placed into it rather than left where they were.
    const blended = lerpViewBox(plan.contentFrom, plan.contentTo, u)
    for (const n of plan.fadeOut)
      n.setAttribute("transform", frameTransform(plan.contentFrom, blended))
    for (const n of plan.fadeIn)
      n.setAttribute("transform", frameTransform(plan.contentTo, blended))
    // Blocks are the exception to riding the frame: they are sized in px, not in map units.
    const shown = this.fitScale(vb)
    this.sizeBlocks(
      plan.blocksOut,
      this.fitScale(plan.vbStart) / (frameScale(plan.contentFrom, blended) * shown),
    )
    this.sizeBlocks(
      plan.blocksIn,
      this.fitScale(plan.layer.render) / (frameScale(plan.contentTo, blended) * shown),
    )
    plan.svg.setAttribute("viewBox", vb.join(" "))
    this.setFades(plan, u)
  }

  /**
   * The two halves of a crossing, run as one movement: the map being left played backwards to
   * the country, then the country forwards into the map being entered. At the join both plans
   * are drawing the overview, so the swap is invisible. The camera follows one curve through.
   */
  private runCross(
    outPlan: MorphPlan,
    inPlan: MorphPlan,
    outDest?: readonly number[],
  ): Promise<"done" | "cancelled"> {
    this.cancelMorph()
    return new Promise((resolve) => {
      const settle = (how: "done" | "cancelled"): void => {
        if (how === "cancelled" && this.morphRAF !== null) caf(this.morphRAF)
        this.morphRAF = null
        this.morphCancel = null
        resolve(how)
      }
      this.morphCancel = () => settle("cancelled")
      // Longer than one morph, shorter than the two it replaces.
      const dur = reducedMotion() ? 0 : Math.round(MORPH_MS * 1.75)
      // Both halves pull back to the same view, or the swap would be a jump — and only as far
      // as it takes to hold both maps, since the whole country is usually a detour.
      const leaving = outDest ?? this.destOf(outPlan)
      const apex = crossApexViewBox(leaving, this.destOf(inPlan), outPlan.vbStart)
      const t0 = nowMs()
      let showingIn = false
      let lastCommit = -Infinity
      const frame = (): void => {
        const elapsed = nowMs() - t0
        if (elapsed > dur * 5 + MORPH_MS) {
          this.setFades(inPlan, 1)
          settle("done")
          return
        }
        const t = dur > 0 ? Math.min(1, elapsed / dur) : 1
        if (t < 1 && elapsed - lastCommit < MORPH_MIN_COMMIT_MS) {
          this.morphRAF = raf(frame)
          return
        }
        lastCommit = elapsed
        const half = t < 0.5
        const plan = half ? outPlan : inPlan
        if (!half && !showingIn) {
          showingIn = true
          this.attachMorphLayer(inPlan.el)
          outPlan.el.remove()
        }
        // Eased at the outer ends only: the halves leave and arrive at rest, and cross the
        // country at full speed.
        const p = half ? easeInCubic(t / 0.5) : easeOutCubic((t - 0.5) / 0.5)
        // Each half is its own drill flown one way or the other, so both are the country at u = 0.
        const u = half ? 1 - p : p
        this.renderMorph(plan, u, this.cameraFor(plan, u, apex, half ? leaving : undefined))
        if (t < 1) this.morphRAF = raf(frame)
        else settle("done")
      }
      this.morphRAF = raf(frame)
    })
  }

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
  private runMorph(
    plan: MorphPlan,
    forward: boolean,
    view: { wide?: readonly number[]; dest?: readonly number[] } = {},
  ): Promise<"done" | "cancelled"> {
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
        // Commit-rate cap: skip this tick entirely when the last commit is too recent. The
        // final frame always commits, so the end state is exact.
        if (t < 1 && elapsed - lastCommit < MORPH_MIN_COMMIT_MS) {
          this.morphRAF = raf(frame)
          return
        }
        lastCommit = elapsed
        const u = forward ? easeInOutCubic(t) : 1 - easeInOutCubic(t)
        this.renderMorph(plan, u, this.cameraFor(plan, u, view.wide, view.dest))
        if (t < 1) this.morphRAF = raf(frame)
        else settle("done")
      }
      this.morphRAF = raf(frame)
    })
  }
}
