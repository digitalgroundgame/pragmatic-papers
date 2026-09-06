"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AssetLoader } from "./assetLoader"
import { DrilldownPane, type DrilldownPaneHandle, type PinRequest } from "./DrilldownPane"
import { DrilldownSearch } from "./DrilldownSearch"
import { DrilldownSelector, type SelectVia } from "./DrilldownSelector"
import { DrilldownTooltip } from "./DrilldownTooltip"
import { DEFAULT_VIEWBOX } from "./geometry"
import { assetKeyFor, recordsFor } from "./records"
import { buildRegionIndex, displayFacts } from "./regions"
import type { SearchResult } from "./search"
import { DrilldownSelectionProvider } from "./selection"
import { MapStage } from "./stage"
import type { ChildAssetRef, DrilldownAsset, RegionIndex } from "./types"

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

function blockIdsFor(
  view: View,
  regions: RegionIndex,
  loaded: Record<string, DrilldownAsset>,
): string[] {
  if (!view.parentId) return regions.topLevel
  const children = regions.childrenOf[view.parentId] ?? []
  const asset = loaded[view.parentId]
  const hasGeometry = asset ? asset.paths.some((p) => p.id) : false
  // A parent with no child geometry keeps the overview on screen: its children join the
  // top-level blocks at their declared anchors.
  return hasGeometry ? children : [...regions.topLevel, ...children]
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
  const paneRef = useRef<DrilldownPaneHandle | null>(null)
  const [loader] = useState(() => new AssetLoader())

  const [loaded, setLoaded] = useState<Record<string, DrilldownAsset>>({})
  const [loadState, setLoadState] = useState<Record<string, LoadState>>({})
  const [view, setView] = useState<View>({ parentId: null })
  const [selected, setSelected] = useState<string | null>(null)
  const [paneOpen, setPaneOpen] = useState(false)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pinRequest, setPinRequest] = useState<(PinRequest & { regionId: string }) | null>(null)
  // How the last selection was made, so keyboard users land in the pane they just opened.
  const lastVia = useRef<SelectVia>("pointer")

  const regions = useMemo(
    () => buildRegionIndex([overview, ...Object.values(loaded)]),
    [overview, loaded],
  )
  const drillable = useMemo(() => new Set(childAssets.map((a) => a.regionId)), [childAssets])
  const urlFor = useCallback(
    (regionId: string) => childAssets.find((a) => a.regionId === regionId)?.url ?? null,
    [childAssets],
  )

  // ---- asset loading -----------------------------------------------------------------------

  const ensureAsset = useCallback(
    async (key: string): Promise<DrilldownAsset | null> => {
      const url = urlFor(key)
      if (!url) return null
      const cached = loader.get(url)
      if (cached) return cached
      setLoadState((s) => ({ ...s, [key]: "loading" }))
      try {
        const asset = await loader.load(url)
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
    [urlFor, loader],
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
    setPaneOpen(false)
  }, [focusSelectorItem])

  const select = useCallback(
    (id: string, via: SelectVia = "pointer", { force = false }: { force?: boolean } = {}) => {
      if (!regions.byId[id]) return
      lastVia.current = via
      // A pin belongs to the region it was made for; selecting elsewhere drops it.
      setPinRequest((cur) => (cur && cur.regionId !== id ? null : cur))
      setSelected((cur) => {
        if (cur === id) {
          // `force` is for a selection that is showing something specific (a search result):
          // re-selecting the region it is already on must not toggle the pane shut.
          setPaneOpen((open) => force || !open)
          return id
        }
        setPaneOpen(true)
        return id
      })
      const key = assetKeyFor(id, regions, childAssets)
      if (key) void ensureAsset(key)
    },
    [regions, childAssets, ensureAsset],
  )

  const drillIn = useCallback(
    async (parentId: string) => {
      const stage = stageRef.current
      if (!stage) return
      if (view.parentId === parentId) {
        setPaneOpen(false)
        return
      }
      const asset = await ensureAsset(parentId)
      if (!asset || !stageRef.current) return
      setPaneOpen(false)
      setSelected(null)
      // The state update carrying this asset has not committed yet; give the stage the merged
      // index now so the child view's blocks are sized from its facts.
      const merged = buildRegionIndex([overview, ...Object.values(loaded), asset])
      stage.setRegions(merged)
      setView({ parentId })
      setBusy(true)
      const how = await stage.drillIn(parentId, asset)
      setBusy(false)
      if (how === "cancelled") return
      stage.renderBlocks(blockIdsFor({ parentId }, merged, { ...loaded, [parentId]: asset }))
    },
    [view.parentId, ensureAsset, overview, loaded],
  )

  const drillOut = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) return
    setPaneOpen(false)
    setSelected(null)
    setView({ parentId: null })
    setBusy(true)
    const how = await stage.drillOut()
    setBusy(false)
    if (how === "cancelled") return
    stage.renderBlocks(regions.topLevel)
  }, [regions.topLevel])

  // A search result names a record, not a region: show the map the record sits on, select its
  // region and ask the pane to pin it. The pane does the pinning once the region's asset has
  // arrived, so a result in a region that is not loaded yet still lands on the right card.
  const pinNonce = useRef(0)

  /** Show the map the region sits on, then select it. Returns false for an unknown region. */
  const revealRegion = useCallback(
    async (regionId: string): Promise<boolean> => {
      if (!regions.byId[regionId]) return false
      const key = assetKeyFor(regionId, regions, childAssets)
      if (key && key !== regionId && view.parentId !== key) await drillIn(key)
      select(regionId, "keyboard", { force: true })
      return true
    },
    [regions, childAssets, view.parentId, drillIn, select],
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

  // ---- stage lifecycle ---------------------------------------------------------------------

  // The stage is created once; it calls back into whichever `select` is current.
  const selectRef = useRef(select)
  useEffect(() => {
    selectRef.current = select
  }, [select])

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
          onHover: (id, point) => setHover(id && point ? { id, x: point.x, y: point.y } : null),
          onSelect: (id, via) => selectRef.current(id, via),
        },
      })
    } catch (err) {
      console.error("[interactive-map] drilldown stage failed to mount:", err)
      return
    }
    stageRef.current = stage
    stage.renderBlocks(buildRegionIndex([overview]).topLevel)
    return () => {
      stage.destroy()
      if (stageRef.current === stage) stageRef.current = null
    }
  }, [overview])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.setRegions(regions)
    if (!busy) stage.renderBlocks(blockIdsFor(view, regions, loaded))
  }, [regions, view, loaded, busy])

  useEffect(() => {
    stageRef.current?.setSelected(selected)
  }, [selected])

  // After a selection: keyboard users move into the pane, and it scrolls into view when it
  // sits below the fold (a phone, or a tall map).
  useEffect(() => {
    if (!selected || !paneOpen) return
    const pane = paneRef.current
    if (!pane) return
    if (lastVia.current === "keyboard") {
      pane.focusHeading()
      return
    }
    const el = rootRef.current?.querySelector<HTMLElement>("[data-drilldown-pane]")
    const rect = el?.getBoundingClientRect()
    if (rect && rect.top > window.innerHeight * 0.6) pane.scrollIntoView()
  }, [selected, paneOpen])

  // Escape closes an open pane from anywhere on the page — a reader who has scrolled into the
  // bench should not have to find the map first.
  useEffect(() => {
    if (!paneOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") deselect()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [paneOpen, deselect])

  // Escape with nothing selected steps back out of a child view, but only while focus is
  // inside the map: elsewhere on the page that key belongs to whatever the reader is using.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key !== "Escape" || paneOpen || !view.parentId) return
    e.preventDefault()
    void drillOut()
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
  const hoverRegion = hover ? (regions.byId[hover.id] ?? null) : null
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
      region={selectedRegion}
      facts={selectedRegion ? displayFacts(selectedRegion, payloadFor(selectedRegion.id)) : []}
      lookups={overview.payload?.lookups}
      records={records}
      recordsState={recordsState}
      open={paneOpen}
      canDrill={canDrill}
      onDrill={() => selectedRegion && void drillIn(selectedRegion.id)}
      onClose={deselect}
    />
  )

  const selection = useMemo(
    () => ({ selected, select: (id: string) => void revealRegion(id) }),
    [selected, revealRegion],
  )

  return (
    <DrilldownSelectionProvider value={selection}>
      {search && (
        <DrilldownSearch
          url={search.url}
          label={search.label}
          regions={regions}
          onSelect={(r) => void revealRecord(r)}
          className="mb-3 max-w-sm"
        />
      )}
      <div
        ref={rootRef}
        data-drilldown-map=""
        onKeyDown={onKeyDown}
        className="flex flex-col gap-3"
      >
        <DrilldownSelector
          regions={regions}
          view={view}
          selected={selected}
          drillable={drillable}
          onSelect={select}
          onBack={() => void drillOut()}
        />
        <div
          ref={viewportRef}
          data-drilldown-viewport=""
          data-view={view.parentId ? "child" : "overview"}
          aria-busy={busy || undefined}
          className="bg-muted/30 @container relative w-full min-w-0 overflow-hidden rounded-lg"
        >
          {children}
          <div ref={layersRef} data-drilldown-layers="" />
        </div>
        {pane}
      </div>
      <DrilldownTooltip
        label={hoverRegion?.label ?? null}
        summary={hoverRegion?.summary ?? null}
        cursor={hover ? { x: hover.x, y: hover.y } : null}
      />
    </DrilldownSelectionProvider>
  )
}
