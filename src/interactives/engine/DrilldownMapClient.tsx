"use client"

import { MapIcon, Maximize2, Minimize2, PanelLeft, PanelRight, ZoomIn, ZoomOut } from "lucide-react"
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/utilities/utils"
import { Separator } from "@/components/ui/separator"

import { AssetLoader } from "./assetLoader"
import { DrilldownPane, type DrilldownPaneHandle, type PinRequest } from "./DrilldownPane"
import { DrilldownSearch } from "./DrilldownSearch"
import { DrilldownSelector, type SelectVia } from "./DrilldownSelector"
import { DrilldownTooltip, type DrilldownTooltipHandle } from "./DrilldownTooltip"
import { DEFAULT_VIEWBOX } from "./geometry"
import { assetKeyFor, recordsFor } from "./records"
import { buildRegionIndex, displayFacts } from "./regions"
import type { SearchResult } from "./search"
import { DrilldownSelectionProvider } from "./selection"
import { MapStage, ZOOM_MAX, ZOOM_STEP } from "./stage"
import { DEBUG_LAYOUT, DEBUG_PARAM } from "./layoutTools"
import { useLayoutEditor } from "./useLayoutEditor"
import type { ChildAssetRef, DrilldownAsset, RegionIndex, RegionInfo } from "./types"

export interface DrilldownMapClientProps {
  /** The overview asset with path data stripped — geometry lives in the server-rendered SVG. */
  overview: DrilldownAsset
  childAssets: ChildAssetRef[]
  /** Empty-state text for the pane. */
  emptyHint?: string
  /**
   * Turns on record search. `url` serves the index (`DrilldownSearch`); `label` names it in
   * the interactive's own vocabulary ("Search judges"). Omitted, no search box is rendered.
   */
  search?: { url: string; label?: string }
  /**
   * Shown in the pane before a region is chosen: an overview of the whole dataset. Reaches the
   * map's selection through `useDrilldownSelection`, so a reader can go from it to a region.
   */
  summary?: React.ReactNode
  /** The server-rendered overview layer. */
  children: React.ReactNode
}

interface View {
  parentId: string | null
}
type LoadState = "loading" | "error"

export function blockIdsFor(
  view: View,
  regions: RegionIndex,
  loaded: Record<string, DrilldownAsset>,
): string[] {
  // The overview draws the top level and nothing else. A region whose children have no map of
  // their own draws them when the reader opens it, like any other region's children.
  if (!view.parentId) return regions.topLevel
  const children = regions.childrenOf[view.parentId] ?? []
  const asset = loaded[view.parentId]
  const hasGeometry = asset ? asset.paths.some((p) => p.id) : false
  // The parent leads its own children. One with no child geometry keeps the overview on
  // screen instead, and its children join the top-level blocks at their declared anchors.
  return hasGeometry ? [view.parentId, ...children] : [...regions.topLevel, ...children]
}

/**
 * Where an address says the reader is: the region they have chosen, or else the map they are
 * standing on — never both, since a region already says which map it is on. A history entry
 * is measured against this rather than against the query string.
 */
function placeOf(q: URLSearchParams): string {
  const region = q.get("region")
  return `${region ?? ""}|${region ? "" : (q.get("view") ?? "")}`
}

export function DrilldownMapClient({
  overview,
  childAssets,
  emptyHint,
  search,
  summary,
  children,
}: DrilldownMapClientProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const layersRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<MapStage | null>(null)
  // The same stage as a value, for the one hook that has to re-run when it appears.
  const [mounted, setMounted] = useState<MapStage | null>(null)
  const paneRef = useRef<DrilldownPaneHandle | null>(null)
  const [loader] = useState(() => new AssetLoader())
  // Whether the reader has said anything about the rail. Null until they do, and the default
  // is then a question of screen — beside the map there is room, on a phone it costs a third
  // of the first screenful. It lives in CSS, so a phone renders folded rather than closing.
  const [railChoice, setRailChoice] = useState<boolean | null>(null)
  const isMobile = useIsMobile()
  const [full, setFull] = useState(false)
  // The browser owns this state — Escape and F11 leave without asking us — so it is read
  // from the document rather than remembered here.
  useEffect(() => {
    const sync = (): void => setFull(document.fullscreenElement === rootRef.current)
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])
  const toggleFull = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    // A rejection means the browser said no, which is its right, and the button not moving
    // says so.
    if (document.fullscreenElement === el) void document.exitFullscreen?.().catch(() => undefined)
    else void el.requestFullscreen?.().catch(() => undefined)
  }, [])
  const railOpen = railChoice ?? !isMobile
  const railId = useId()

  const paneId = useId()

  const [loaded, setLoaded] = useState<Record<string, DrilldownAsset>>({})
  const [loadState, setLoadState] = useState<Record<string, LoadState>>({})
  const [view, setView] = useState<View>({ parentId: null })
  const [selected, setSelected] = useState<string | null>(null)
  // Closed on arrival: the map is what a reader came for. Choosing a region opens it.
  const [paneOpen, setPaneOpen] = useState(false)
  /** One panel at a time: both open leave a map too narrow to be the thing they are about. */
  const showRail = useCallback((open: boolean) => {
    setRailChoice(open)
    if (open) setPaneOpen(false)
  }, [])
  const showPane = useCallback((open: boolean) => {
    setPaneOpen(open)
    if (open) setRailChoice(false)
  }, [])
  /** The folded rail's search glyph: a box needs the rail's width, so the glyph unfolds it. */
  const unfoldToSearch = useCallback(() => {
    showRail(true)
    // The box is only mounted once the rail is open.
    requestAnimationFrame(() => {
      document
        .getElementById(railId)
        ?.querySelector<HTMLInputElement>("[data-drilldown-search] input")
        ?.focus()
    })
  }, [showRail, railId])

  // The tooltip is driven straight rather than through state: it follows a pointer, and a
  // pointer reports itself far more often than anything above it has anything new to say.
  const tooltipRef = useRef<DrilldownTooltipHandle | null>(null)
  // How far the camera has moved in, mirrored from the stage so the controls can say whether
  // there is anything to pan around or come back from.
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [pinRequest, setPinRequest] = useState<(PinRequest & { regionId: string }) | null>(null)
  // The record the reader has pinned in the pane, mirrored here only so the URL can carry it.
  const [pinned, setPinned] = useState<string | null>(null)
  // The one region showing its children in the rail. One at a time: 94 districts open at once
  // turn it into a scroll with no landmarks. Drilling in opens that branch, and fetches it.
  const [expanded, setExpanded] = useState<string | null>(null)
  // How the last selection was made, so keyboard users land in the pane they just opened.
  const lastVia = useRef<SelectVia>("pointer")
  // Set while the reader is between places — a move in flight, or the address being read
  // back. The address records where they land, never the steps taken to get there: reaching a
  // district is one click and one entry to go back from. `settled` is bumped when a move ends.
  const moving = useRef(false)
  const [settled, setSettled] = useState(0)

  const regions = useMemo(
    () => buildRegionIndex([overview, ...Object.values(loaded)]),
    [overview, loaded],
  )
  // Read once, from the address the page was opened at: a tool an editor arrives with, not a
  // mode to toggle. See `useLayoutEditor`.
  const [layoutEditing] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get(DEBUG_PARAM) === DEBUG_LAYOUT,
  )
  useLayoutEditor(mounted, layoutEditing)

  const drillable = useMemo(() => new Set(childAssets.map((a) => a.regionId)), [childAssets])
  const refFor = useCallback(
    (regionId: string) => childAssets.find((a) => a.regionId === regionId) ?? null,
    [childAssets],
  )

  // ---- asset loading -----------------------------------------------------------------------

  const ensureAsset = useCallback(
    async (key: string): Promise<DrilldownAsset | null> => {
      const ref = refFor(key)
      if (!ref) return null
      const cached = loader.get(ref.url)
      if (cached) return cached
      setLoadState((s) => ({ ...s, [key]: "loading" }))
      try {
        const asset = await loader.load(ref.url, ref.geometryUrl)
        setLoaded((prev) => (prev[key] === asset ? prev : { ...prev, [key]: asset }))
        setLoadState((s) => {
          const { [key]: _omit, ...rest } = s
          return rest
        })
        return asset
      } catch (err) {
        console.error(`[interactive-map] failed to load region asset for "${key}":`, err)
        setLoadState((s) => ({ ...s, [key]: "error" }))
        return null
      }
    },
    [refFor, loader],
  )

  // ---- selection / navigation -------------------------------------------------------------

  const focusSelectorItem = useCallback((id: string | null) => {
    if (!id || !rootRef.current) return
    const items = rootRef.current.querySelectorAll<HTMLButtonElement>(
      "[data-drilldown-selector] button[data-region-item]",
    )
    for (const item of items) if (item.dataset.regionItem === id) return item.focus()
  }, [])

  const deselect = useCallback(() => {
    setSelected((cur) => {
      // Hand focus back to where the selection is made from, so Escape/× do not drop it.
      if (cur && rootRef.current?.contains(document.activeElement)) focusSelectorItem(cur)
      return null
    })
    setPinned(null)
    setPaneOpen(false)
  }, [focusSelectorItem])

  const select = useCallback(
    (id: string, via: SelectVia = "pointer", { force = false }: { force?: boolean } = {}) => {
      if (!regions.byId[id]) return
      lastVia.current = via
      // A pin belongs to the region it was made for; selecting elsewhere drops it.
      setPinRequest((cur) => (cur && cur.regionId !== id ? null : cur))
      setPinned(null)
      setSelected((cur) => {
        if (cur === id) {
          // `force` is for a search result: landing on the region it is already on must not
          // toggle the pane shut.
          setPaneOpen((open) => {
            const next = force || !open
            if (next) setRailChoice(false)
            return next
          })
          return id
        }
        showPane(true)
        return id
      })
      const key = assetKeyFor(id, regions, childAssets)
      if (key) void ensureAsset(key)
    },
    [regions, childAssets, ensureAsset, showPane],
  )

  /**
   * Which map the stage is actually showing, which React state can be wrong about: a rebuilt
   * stage (Strict Mode, a new overview asset) starts at the overview however far the reader
   * had drilled, and every guard reading state would agree they were already there.
   */
  const shownParent = useCallback((): string | null => stageRef.current?.currentParent ?? null, [])

  const drillOut = useCallback(async (): Promise<"done" | "fallback" | "cancelled"> => {
    const stage = stageRef.current
    if (!stage) return "cancelled"
    setPaneOpen(false)
    setSelected(null)
    setPinned(null)
    setView({ parentId: null })
    setBusy(true)
    const how = await stage.drillOut()
    setBusy(false)
    if (how === "cancelled") return how
    stage.renderBlocks(blockIdsFor({ parentId: null }, regions, loaded))
    return how
  }, [regions, loaded])

  /**
   * Move into a region's own map. `via` is set when the reader asked for the *region* and not
   * merely for its map — clicking a circuit — and then it stays selected through the morph, so
   * the pane that greets them on arrival is the circuit's own bench.
   */
  const drillIn = useCallback(
    async (parentId: string, via: SelectVia | null = null) => {
      const stage = stageRef.current
      if (!stage) return
      if (view.parentId === parentId && shownParent() === parentId) {
        setPaneOpen(false)
        return
      }
      // Crossing from one child map to another is one movement (`crossTo`), not a drill out
      // and a drill in. The asset comes first: there is nothing to cross to until it has.
      const crossing = shownParent() !== null && shownParent() !== parentId
      const asset = await ensureAsset(parentId)
      if (!asset || !stageRef.current) {
        // The map could not be fetched, but the region was still asked for: open the pane on
        // it, where the error and the drill button — now a retry — are shown.
        if (via) select(parentId, via)
        return
      }
      if (via) lastVia.current = via
      setExpanded(parentId)
      showPane(via !== null)
      setSelected(via ? parentId : null)
      // The state update carrying this asset has not committed yet.
      const merged = buildRegionIndex([overview, ...Object.values(loaded), asset])
      stage.setRegions(merged)
      setView({ parentId })
      setBusy(true)
      const how = crossing
        ? await stage.crossTo(parentId, asset)
        : await stage.drillIn(parentId, asset)
      setBusy(false)
      if (how === "cancelled") return
      // The morph clears the map's own highlight; put it back on the region the reader chose.
      if (via) stage.setSelected(parentId)
      stage.renderBlocks(blockIdsFor({ parentId }, merged, { ...loaded, [parentId]: asset }))
      // A region with no map of its own has just brought the country back, and its bench is
      // the only thing on it that changed.
      if (how === "no-geometry") stage.focusOn(parentId)
    },
    [view.parentId, shownParent, ensureAsset, overview, loaded, select, showPane],
  )

  /**
   * What choosing a region means, wherever it is chosen from. One with a map of its own opens
   * it in a single click; one on a map the reader is not standing on is reached by moving to
   * that map first. Anything already on screen simply selects.
   */
  const open = useCallback(
    async (id: string, via: SelectVia = "pointer", opts?: { force?: boolean }): Promise<void> => {
      if (!regions.byId[id]) return
      // The whole move is one journey: writing the states it passes through would put a map
      // the reader only crossed into their history, so the address is written once, at the end.
      const outer = moving.current
      moving.current = true
      try {
        if (drillable.has(id) && shownParent() !== id) {
          await drillIn(id, via)
          return
        }
        const key = assetKeyFor(id, regions, childAssets)
        if (key && key !== id && shownParent() !== key) await drillIn(key)
      } finally {
        moving.current = outer
        if (!outer) setSettled((n) => n + 1)
      }
      select(id, via, opts)
    },
    [regions, childAssets, drillable, shownParent, drillIn, select],
  )

  // A search result names a record, not a region. The pane does the pinning once the region's
  // asset has arrived, so a result in a region not loaded yet still lands on the right card.
  const pinNonce = useRef(0)

  /** Show the map the region sits on, then select it. Returns false for an unknown region. */
  const revealRegion = useCallback(
    async (regionId: string): Promise<boolean> => {
      if (!regions.byId[regionId]) return false
      await open(regionId, "keyboard", { force: true })
      return true
    },
    [regions, open],
  )

  const revealRecord = useCallback(
    async (result: SearchResult) => {
      if (!(await revealRegion(result.region))) return
      pinNonce.current += 1
      // The selection above is what clears a pin left on another region, so pin after it.
      setPinRequest({ regionId: result.region, recordId: result.id, nonce: pinNonce.current })
    },
    [revealRegion],
  )

  /** Open a region's children in the rail — closing whichever was open — or close its own. */
  const toggleExpanded = useCallback(
    (id: string) => {
      setExpanded((cur) => (cur === id ? null : id))
      if (expanded !== id) void ensureAsset(id)
    },
    [expanded, ensureAsset],
  )

  // ---- the URL as the map's address ----------------------------------------------------------

  /**
   * Where the reader is, written into the query string: `region` is the one selected, `view`
   * the map they stand on with nothing selected, `pane` whether the pane is open and `record`
   * the pinned card. Written by hand rather than through the router — this is the same
   * document either way, and a navigation would re-run the page's fetch for the same markup.
   */
  /** Nothing is written until the address has been read, or the read would erase itself. */
  const restored = useRef(false)
  /**
   * The place the address last named, so a write that only rephrases it is not a step taken.
   * A flag for "just restored" cannot do this job: a bare arrival needs no tidying, so nothing
   * clears it, and it swallows the reader's first real move instead — which is the entry Back
   * needs.
   */
  const placed = useRef<string | null>(null)

  const applyUrl = useCallback(
    async (query: string) => {
      const q = new URLSearchParams(query)
      const region = q.get("region")
      const parent = q.get("view")
      const record = q.get("record")
      moving.current = true
      try {
        if (region && regions.byId[region]) {
          await revealRegion(region)
          // Revealing a region opens the pane, which is only right if the address agrees. A
          // pinned record agrees by itself: the card it names lives in the pane.
          showPane(q.get("pane") === "1" || !!record)
          if (record) {
            pinNonce.current += 1
            setPinRequest({ regionId: region, recordId: record, nonce: pinNonce.current })
            setPinned(record)
          }
          return
        }
        deselect()
        // Against the stage, not against state: on a remount the address has already been
        // applied to a stage that no longer exists.
        if (parent && parent !== shownParent()) await drillIn(parent)
        else if (!parent && shownParent()) await drillOut()
        // Only when the address asks for it: a bare arrival names nothing, and closing the
        // pane here would do it over a reader who had just opened it.
        if (q.get("pane") === "1") showPane(true)
      } finally {
        moving.current = false
        placed.current = placeOf(q)
      }
    },
    [regions, shownParent, revealRegion, drillIn, drillOut, deselect, showPane],
  )

  // Read the address once on mount, and again whenever the reader moves through history.
  const applyUrlRef = useRef(applyUrl)
  useEffect(() => {
    applyUrlRef.current = applyUrl
  }, [applyUrl])
  useEffect(() => {
    const onPop = (): void => void applyUrlRef.current(window.location.search)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useEffect(() => {
    if (!restored.current || moving.current) return
    const q = new URLSearchParams(window.location.search)
    const before = q.toString()
    const set = (key: string, value: string | null): void => {
      if (value) q.set(key, value)
      else q.delete(key)
    }
    // Two questions, two keys: where the reader is — a selected region, which already says
    // which map it is on, or else the map itself, never both — and whether the pane is open.
    // Implying the second from which of the first two was written made closing the pane on a
    // circuit look like going somewhere.
    set("region", selected)
    set("view", selected ? null : view.parentId)
    set("pane", paneOpen ? "1" : null)
    set("record", selected && paneOpen ? pinned : null)
    const after = q.toString()
    // Moving the map or the pane is a step worth going back from; re-pinning a card is not,
    // and nor is saying the same place a second way.
    const place = placeOf(q)
    const step = placed.current !== null && placed.current !== place
    placed.current = place
    if (after === before) return
    const url = `${window.location.pathname}${after ? `?${after}` : ""}${window.location.hash}`
    window.history[step ? "pushState" : "replaceState"](null, "", url)
  }, [view.parentId, selected, paneOpen, pinned, settled])

  // ---- stage lifecycle ---------------------------------------------------------------------

  // The stage is created once; it calls back into whichever `open` and index are current.
  const regionsRef = useRef(regions)
  useEffect(() => {
    regionsRef.current = regions
  }, [regions])
  const selectRef = useRef(open)
  useEffect(() => {
    selectRef.current = open
  }, [open])

  useEffect(() => {
    const viewport = viewportRef.current
    const layersHost = layersRef.current
    const overviewLayer = viewport?.querySelector<HTMLElement>('[data-drilldown-layer="overview"]')
    if (!viewport || !layersHost || !overviewLayer) return
    let stage: MapStage
    try {
      stage = new MapStage({
        viewport,
        overviewLayer,
        layersHost,
        overviewViewBox: overview.viewBox ?? DEFAULT_VIEWBOX,
        flipY: overview.flipY,
        regions: buildRegionIndex([overview]),
        seats: overview.payload?.seats ?? null,
        callbacks: {
          onHover: (id, point) => {
            const region = id ? (regionsRef.current.byId[id] ?? null) : null
            tooltipRef.current?.point(
              region && { label: region.label, summary: region.summary },
              point,
            )
          },
          onSelect: (id, via) => void selectRef.current(id, via),
          onCamera: setZoom,
          // The map a drag happened on decides what its number is worth: the Ninth's block
          // has one place on the national map and another in the gutter of its own.
          onAnchorMoved: (id, at, where) =>
            // eslint-disable-next-line no-console -- the layout editor's whole output
            console.info(
              `[interactive-map] anchor "${id}": [${at[0]}, ${at[1]}] — on ${where.layer}` +
                (where.writable ? " (anchors.json)" : " (gutter, computed — not from a file)"),
            ),
          onLayoutReset: (id, where) =>
            // eslint-disable-next-line no-console -- the layout editor's whole output
            console.info(`[interactive-map] reset "${id}" — on ${where.layer}`),
          onRegionMoved: (id, by, where) =>
            // eslint-disable-next-line no-console -- the layout editor's whole output
            console.info(
              `[interactive-map] offset "${id}": [${by[0]}, ${by[1]}] — on ${where.layer}` +
                (where.writable ? " (offsets.json)" : " (this map has no offsets file)"),
            ),
        },
      })
    } catch (err) {
      console.error("[interactive-map] drilldown stage failed to mount:", err)
      return
    }
    stageRef.current = stage
    setMounted(stage)
    stage.renderBlocks(buildRegionIndex([overview]).topLevel)
    // Only now can a drill run, so this is where a deep link is honoured.
    void applyUrlRef.current(window.location.search).finally(() => {
      restored.current = true
    })
    return () => {
      stage.destroy()
      if (stageRef.current === stage) stageRef.current = null
      setMounted(null)
    }
  }, [overview])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.setRegions(regions)
    // Blocks are drawn into whichever layer the stage has up, so the set of them is chosen
    // from the same place: taken from `view`, a stage that never reached that map would draw
    // a child's blocks across the overview at anchors measured for a map not on screen.
    if (!busy) stage.renderBlocks(blockIdsFor({ parentId: stage.currentParent }, regions, loaded))
  }, [regions, view, loaded, busy])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.setSelected(selected)
    // A court with no territory is a block standing in the sea, and moving in a little is
    // what answers "where is it". Everything else has a shape to light up.
    if (selected && !stage.drawsShape(selected)) stage.focusOn(selected)
    else stage.clearSentCamera()
  }, [selected])

  // A keyboard selection moves focus into the pane it opened, since a keyboard reader has no
  // other way there. A pointer selection moves nothing: the map is what they are looking at.
  useEffect(() => {
    if (!selected || !paneOpen) return
    if (lastVia.current === "keyboard") paneRef.current?.focusHeading()
  }, [selected, paneOpen])

  // Escape closes an open pane from anywhere on the page.
  useEffect(() => {
    if (!paneOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") deselect()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [paneOpen, deselect])

  /**
   * The map's shortcuts, live while focus is inside it — elsewhere on the page these keys
   * belong to whatever the reader is using, and inside a text field they belong to the text.
   *
   * The arrows are the exception to "inside it": at rest they are how the rail's tree is
   * walked, so they only pan once there is a map larger than the frame to pan around, and only
   * from the map itself.
   */
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const from = e.target instanceof Element ? e.target : null
    if (from?.closest("input, textarea, select, [contenteditable='true']")) return
    const stage = stageRef.current
    const pan = (dx: number, dy: number): void => {
      if (!stage || stage.zoom <= 1 || !from?.closest("[data-drilldown-viewport]")) return
      e.preventDefault()
      stage.panBy(dx * stage.panStep, dy * stage.panStep)
    }
    switch (e.key) {
      case "Escape":
        if (paneOpen || !view.parentId) return
        e.preventDefault()
        void drillOut()
        return
      case "f":
      case "F":
        e.preventDefault()
        toggleFull()
        return
      case "+":
      case "=":
        e.preventDefault()
        stage?.zoomBy(ZOOM_STEP)
        return
      case "-":
      case "_":
        e.preventDefault()
        stage?.zoomBy(1 / ZOOM_STEP)
        return
      case "0":
        e.preventDefault()
        stage?.resetCamera()
        return
      case "ArrowLeft":
        return pan(-1, 0)
      case "ArrowRight":
        return pan(1, 0)
      case "ArrowUp":
        return pan(0, -1)
      case "ArrowDown":
        return pan(0, 1)
      default:
        return
    }
  }

  // ---- derived view model ------------------------------------------------------------------

  const selectedRegion = selected ? (regions.byId[selected] ?? null) : null
  const selectedKey = selected ? assetKeyFor(selected, regions, childAssets) : null
  const selectedAsset = selectedKey ? (loaded[selectedKey] ?? null) : null
  const recordsState: "idle" | "loading" | "error" =
    selectedKey && loadState[selectedKey] ? loadState[selectedKey]! : "idle"
  const records = useMemo(
    () =>
      selected
        ? recordsFor(selected, overview, selectedAsset)
        : { seats: [], display: null, associates: [] },
    [selected, overview, selectedAsset],
  )
  const payloadFor = (regionId: string | null) => {
    const key = regionId ? assetKeyFor(regionId, regions, childAssets) : null
    const asset = key ? loaded[key] : undefined
    return asset?.payload?.facts || asset?.payload?.seats ? asset.payload : overview.payload
  }
  /**
   * Where the reader is, from the whole map down: the deepest thing they have chosen, with its
   * ancestors as the way back and the overview as the icon at the head.
   */
  const trail = useMemo(() => {
    const path: RegionInfo[] = []
    const seen = new Set<string>()
    let cur: string | null = ((paneOpen && selected) || view.parentId) ?? null
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const region = regions.byId[cur]
      if (region) path.unshift(region)
      cur = region?.parentId ?? null
    }
    return path
  }, [paneOpen, selected, view.parentId, regions])
  const canDrill =
    !!selectedRegion &&
    view.parentId !== selectedRegion.id &&
    (drillable.has(selectedRegion.id) || (regions.childrenOf[selectedRegion.id]?.length ?? 0) > 0)

  const pane = (
    <DrilldownPane
      ref={paneRef}
      emptyHint={emptyHint}
      summary={summary}
      pinRequest={pinRequest && pinRequest.regionId === selected ? pinRequest : null}
      onPin={setPinned}
      region={selectedRegion}
      facts={selectedRegion ? displayFacts(selectedRegion, payloadFor(selectedRegion.id)) : []}
      lookups={overview.payload?.lookups}
      records={records}
      recordsState={recordsState}
      open={paneOpen}
      canDrill={canDrill}
      onDrill={() => selectedRegion && void drillIn(selectedRegion.id)}
    />
  )

  const selection = useMemo(
    () => ({ selected, select: (id: string) => void revealRegion(id) }),
    [selected, revealRegion],
  )

  return (
    <DrilldownSelectionProvider value={selection}>
      <div
        ref={rootRef}
        data-drilldown-map=""
        onKeyDown={onKeyDown}
        // The stage's height, which the map letterboxes inside and the rail is capped to.
        // What fullscreen does to it is a `:fullscreen` rule in `styles.css`.
        className="flex flex-col gap-3 [--drilldown-stage-h:clamp(18rem,78vw,26rem)] md:[--drilldown-stage-h:clamp(26rem,70vh,42rem)]"
      >
        {/* The rail rides beside the map from tablet up, and above it on a phone. */}
        <div className="flex min-w-0 flex-col gap-1 md:flex-row md:items-start">
          {/* Folded, the rail keeps a column of numerals, so changing circuit stays one
              press. Above the map there is no narrow column to keep, so there it folds away
              along its height — `0fr → 1fr`, the same trick the branches use. */}
          <div
            id={railId}
            // Folded is not hidden on a wide screen: the glyphs are the point of folding.
            inert={(!railOpen && isMobile) || undefined}
            className={cn(
              "grid motion-safe:transition-[grid-template-rows,width] motion-safe:duration-200 motion-safe:ease-out",
              "grid-cols-[1fr]",
              railChoice === null
                ? "grid-rows-[0fr] md:w-56 md:grid-rows-[1fr] lg:w-64"
                : railChoice
                  ? "grid-rows-[1fr] md:w-56 lg:w-64"
                  : "grid-rows-[0fr] md:w-9 md:grid-rows-[1fr]",
            )}
          >
            {/* The clip is the rail's exact box, so a focus ring or a shadow was cut off at
                the edge; padding gives it room, and the column's own width carries it rather
                than a negative margin, which would let the rail spill past its column and
                scroll the page sideways. Only while open above the map, where folding goes to
                no height and the padding box would show four pixels of the selected row. */}
            <div className={cn("min-h-0 min-w-0 overflow-hidden md:p-1", railOpen && "p-1")}>
              <DrilldownSelector
                regions={regions}
                view={view}
                selected={selected}
                drillable={drillable}
                expanded={expanded}
                onSelect={(id, via) => void open(id, via)}
                onToggle={toggleExpanded}
                onBack={() => void drillOut()}
                icons={overview.payload?.icons}
                search={
                  search && (
                    <DrilldownSearch
                      url={search.url}
                      label={search.label}
                      regions={regions}
                      onSelect={(r) => void revealRecord(r)}
                    />
                  )
                }
                collapsed={!railOpen}
                onSearch={search ? unfoldToSearch : undefined}
                className="w-full"
              />
            </div>
          </div>
          <div
            ref={viewportRef}
            data-drilldown-viewport=""
            data-view={view.parentId ? "child" : "overview"}
            aria-busy={busy || undefined}
            // Focusable by script only, so the map gains no tab stop of its own but does take
            // focus when a reader touches it — which is what puts the shortcuts within reach
            // without them having to tab to a region first.
            tabIndex={-1}
            onPointerDown={(e) => {
              // The map itself, not the controls over it: a button pressed here must keep the
              // focus it was given, or a keyboard reader loses their place in the bar.
              if (!(e.target instanceof Element) || !e.target.closest("[data-drilldown-layer]"))
                return
              viewportRef.current?.focus({ preventScroll: true })
            }}
            className={cn(
              // The map keeps its whole height and gives up width instead. `flex-1` only
              // from `md`, where the row flexes across; on a phone it is a column, and a basis
              // of zero there is a map of no height at all.
              "bg-muted/30 @container relative h-(--drilldown-stage-h) min-w-0 overflow-hidden rounded-lg md:flex-1",
              // The ring on the map itself; the hover outline follows focus in stage.ts.
              "has-[path[tabindex]:focus-visible]:outline-ring has-[path[tabindex]:focus-visible]:outline-2 has-[path[tabindex]:focus-visible]:outline-offset-2",
            )}
          >
            {/* One bar across the top of the map: where the reader is on the left, what they
                can do to it on the right. A row rather than two absolutely placed corners, so
                a long trail truncates against the controls instead of running under them. */}
            <div className="absolute inset-x-2 top-1 z-10 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-drilldown-rail-toggle=""
                aria-expanded={railOpen}
                aria-controls={railId}
                aria-label={railOpen ? "Hide the region list" : "Show the region list"}
                onClick={() => showRail(!railOpen)}
                className="shrink-0"
              >
                <PanelLeft aria-hidden="true" />
              </Button>
              {trail.length > 0 && (
                <>
                  <Separator orientation="vertical" className="mr-2" />
                  <Breadcrumb
                    data-drilldown-trail=""
                    aria-label="Where you are on the map"
                    className="min-w-0"
                  >
                    <BreadcrumbList className="flex-nowrap gap-1 sm:gap-1.5">
                      <BreadcrumbItem>
                        <BreadcrumbLink
                          render={
                            <button
                              type="button"
                              data-drilldown-trail-root=""
                              aria-label="Back to the whole map"
                              onClick={() => {
                                void drillOut()
                                // The rail is left as the reader had it: folded it is still a
                                // column of regions to choose from.
                                showPane(false)
                              }}
                              className="flex items-center"
                            />
                          }
                        >
                          <MapIcon aria-hidden="true" className="size-4" />
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      {trail.map((region, i) => (
                        <React.Fragment key={region.id}>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem className="min-w-0">
                            {i === trail.length - 1 ? (
                              <BreadcrumbPage className="truncate" title={region.label}>
                                {region.label}
                              </BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink
                                title={region.label}
                                render={
                                  <button
                                    type="button"
                                    data-drilldown-trail-item={region.id}
                                    onClick={() => void open(region.id, "keyboard")}
                                    className="max-w-40 truncate"
                                  />
                                }
                              >
                                {region.label}
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                        </React.Fragment>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>
                </>
              )}
              {/* The camera, then the panels: two different things, so a rule between them —
                  and both kept out of the trail's way by the row rather than by a guess at how
                  much room the trail has left. */}
              <div data-drilldown-zoom="" className="ml-auto flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom out"
                  title="Zoom out (−)"
                  onClick={() => stageRef.current?.zoomBy(1 / ZOOM_STEP)}
                  disabled={zoom <= 1}
                >
                  <ZoomOut aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom in"
                  title="Zoom in (+)"
                  onClick={() => stageRef.current?.zoomBy(ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                >
                  <ZoomIn aria-hidden="true" />
                </Button>
                {/* Written out rather than drawn: every "fit" glyph in the set is a variation
                    on the corner brackets that mean full screen, and the button beside it is
                    the one that means full screen. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  data-drilldown-zoom-reset=""
                  aria-label="Fit the whole map"
                  title="Fit the whole map (0)"
                  onClick={() => stageRef.current?.resetCamera()}
                  disabled={zoom <= 1}
                >
                  <span aria-hidden="true" className="text-[0.7rem] font-semibold">
                    1×
                  </span>
                </Button>
              </div>
              <Separator orientation="vertical" className="mx-1 shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-drilldown-pane-toggle-map=""
                aria-expanded={paneOpen}
                aria-controls={paneId}
                aria-label={paneOpen ? "Hide the details" : "Show the details"}
                onClick={() => showPane(!paneOpen)}
                className="shrink-0"
              >
                <PanelRight aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-drilldown-fullscreen=""
                aria-pressed={full}
                aria-label={full ? "Leave full screen" : "Full screen"}
                title={full ? "Leave full screen (F)" : "Full screen (F)"}
                onClick={toggleFull}
                className="shrink-0"
              >
                {full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              </Button>
            </div>
            {children}
            <div ref={layersRef} data-drilldown-layers="" />
          </div>
          {/* Beside the map, not beneath it, where its height always cost the map more than
              it could spare. It folds along its width here and its height on a phone. */}
          <div
            id={paneId}
            // Closed means nothing to act on only when there is no landing summary either —
            // otherwise this made every seat in it unclickable, since `inert` disables the
            // whole subtree regardless of what is actually drawn inside it.
            inert={(!paneOpen && !summary) || undefined}
            className={cn(
              "grid min-w-0 motion-safe:transition-[grid-template-columns,grid-template-rows] motion-safe:duration-200 motion-safe:ease-out",
              // A landing summary needs the same room a selected region's sheet gets — the
              // 0fr column this collapses to otherwise doesn't stop it rendering, only stops
              // it being reachable: its fixed sheet width still lays out past the column's
              // clipped edge, off both the scrollable page and the click a reader makes at it.
              paneOpen || summary
                ? "grid-cols-[1fr] grid-rows-[1fr]"
                : "grid-cols-[1fr] grid-rows-[0fr] md:grid-cols-[0fr] md:grid-rows-[1fr]",
            )}
          >
            {/* Room for a ring while it is open; none when it is folded, or four pixels of
                the pane's own border would show against the map. */}
            <div className={cn("min-h-0 min-w-0 overflow-hidden", paneOpen && "-m-1 p-1")}>
              <div
                data-drilldown-sheet=""
                data-open={paneOpen ? "" : undefined}
                className="bg-card border-border flex min-h-0 flex-col rounded-lg border md:h-(--drilldown-stage-h) md:w-90"
              >
                {pane}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DrilldownTooltip ref={tooltipRef} />
    </DrilldownSelectionProvider>
  )
}
