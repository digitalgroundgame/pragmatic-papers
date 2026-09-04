"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AssetLoader } from "./assetLoader"
import { DrilldownPane } from "./DrilldownPane"
import { DrilldownSelector } from "./DrilldownSelector"
import { DrilldownTooltip } from "./DrilldownTooltip"
import { DEFAULT_VIEWBOX, padViewBox } from "./geometry"
import { assetKeyFor, recordsFor } from "./records"
import { buildRegionIndex, displayFacts } from "./regions"
import { MapStage } from "./stage"
import type { ChildAssetRef, DrilldownAsset, RegionIndex } from "./types"

export interface DrilldownMapClientProps {
  /** The overview asset with path data stripped — geometry lives in the server-rendered SVG. */
  overview: DrilldownAsset
  childAssets: ChildAssetRef[]
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
  children,
}: DrilldownMapClientProps): React.ReactElement {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const layersRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<MapStage | null>(null)
  const [loader] = useState(() => new AssetLoader())

  const [loaded, setLoaded] = useState<Record<string, DrilldownAsset>>({})
  const [loadState, setLoadState] = useState<Record<string, LoadState>>({})
  const [view, setView] = useState<View>({ parentId: null })
  const [selected, setSelected] = useState<string | null>(null)
  const [paneOpen, setPaneOpen] = useState(false)
  const [paneStowed, setPaneStowed] = useState(false)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const regions = useMemo(
    () => buildRegionIndex([overview, ...Object.values(loaded)]),
    [overview, loaded],
  )
  const drillable = useMemo(() => new Set(childAssets.map((a) => a.regionId)), [childAssets])
  const urlFor = useCallback(
    (regionId: string) => childAssets.find((a) => a.regionId === regionId)?.url ?? null,
    [childAssets],
  )

  const viewBox = padViewBox(overview.viewBox ?? DEFAULT_VIEWBOX)

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

  const deselect = useCallback(() => {
    setSelected(null)
    setPaneOpen(false)
  }, [])

  const select = useCallback(
    (id: string) => {
      if (!regions.byId[id]) return
      setSelected((cur) => {
        if (cur === id) {
          setPaneOpen((open) => !open)
          return id
        }
        setPaneOpen(true)
        return id
      })
      setPaneStowed(false)
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
          onSelect: (id) => selectRef.current(id),
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

  useEffect(() => {
    if (!paneOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") deselect()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [paneOpen, deselect])

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

  return (
    <>
      <div data-drilldown-map="" className="flex flex-col gap-3 sm:flex-row sm:items-start">
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
          className="bg-muted/30 relative min-h-80 min-w-0 flex-1 overflow-hidden rounded-sm"
          style={{ aspectRatio: `${viewBox[2]} / ${viewBox[3]}` }}
        >
          {children}
          <div ref={layersRef} data-drilldown-layers="" />
          <DrilldownPane
            region={selectedRegion}
            facts={
              selectedRegion ? displayFacts(selectedRegion, payloadFor(selectedRegion.id)) : []
            }
            records={records}
            recordsState={recordsState}
            open={paneOpen}
            stowed={paneStowed}
            canDrill={canDrill}
            onDrill={() => selectedRegion && void drillIn(selectedRegion.id)}
            onClose={deselect}
            onStow={setPaneStowed}
          />
        </div>
      </div>
      <DrilldownTooltip
        label={hoverRegion?.label ?? null}
        summary={hoverRegion?.summary ?? null}
        facts={hoverRegion ? displayFacts(hoverRegion, payloadFor(hoverRegion.id)) : []}
        cursor={hover ? { x: hover.x, y: hover.y } : null}
      />
    </>
  )
}
