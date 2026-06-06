"use client"

import { cva } from "class-variance-authority"
import React, { useEffect, useId, useMemo, useState } from "react"

import type { ResolvedMap, ResolvedRegion } from "@/blocks/InteractiveMap/types"
import type { InteractiveMapBlock } from "@/payload-types"
import { Region } from "./Region"
import { HoverTooltip, PinnedTooltipList, type PinnedTooltip } from "./Tooltip"

interface InteractiveMapClientProps {
  layout: InteractiveMapBlock["layout"]
  maps: ResolvedMap[]
}

const widgetVariants = cva("", {
  variants: {
    layout: {
      row: "flex flex-col gap-3 sm:flex-row sm:items-start",
      stacked: "grid grid-cols-1 gap-3 sm:grid-cols-2",
    },
  },
  defaultVariants: { layout: "row" },
})

export function InteractiveMapClient({
  layout,
  maps,
}: InteractiveMapClientProps): React.ReactElement {
  const widgetId = useId()
  const [pinned, setPinned] = useState<PinnedTooltip[]>([])
  const [hoverRegion, setHoverRegion] = useState<{
    mapIndex: number
    region: ResolvedRegion
  } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const pinnedKeySet = useMemo(
    () => new Set(pinned.map((p) => `${p.mapIndex}:${p.region.regionId}`)),
    [pinned],
  )

  function handleEnter(mapIndex: number, region: ResolvedRegion) {
    if (pinnedKeySet.has(`${mapIndex}:${region.regionId}`)) {
      setHoverRegion(null)
      return
    }
    setHoverRegion({ mapIndex, region })
  }

  function handleLeave() {
    setHoverRegion(null)
  }

  function handleClick(mapIndex: number, region: ResolvedRegion, x: number, y: number) {
    const key = `${mapIndex}:${region.regionId}`
    if (pinnedKeySet.has(key)) {
      setPinned((prev) =>
        prev.filter((p) => !(p.mapIndex === mapIndex && p.region.regionId === region.regionId)),
      )
      setHoverRegion(null)
    } else {
      setPinned((prev) => [
        ...prev,
        { id: `${mapIndex}-${region.regionId}`, mapIndex, region, cursor: { x, y } },
      ])
      // Don't clear hoverRegion here — keeps hover tooltip visible while pinned tooltip mounts,
      // preventing the disappear/reappear flash.
    }
  }

  useEffect(() => {
    if (!hoverRegion) return
    const onMove = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [hoverRegion])

  const hasPins = pinned.length > 0

  useEffect(() => {
    if (!hasPins) return
    const onDocPointer = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (target?.closest("[data-interactive-map-path]")) return
      setPinned([])
      setHoverRegion(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned([])
        setHoverRegion(null)
      }
    }
    document.addEventListener("pointerdown", onDocPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDocPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [hasPins])

  return (
    <div aria-label="Interactive map widget" className={widgetVariants({ layout })} role="group">
      {maps.map((map, mapIndex) => (
        <Region
          key={`${widgetId}-${mapIndex}`}
          map={map}
          mapIndex={mapIndex}
          pinned={pinned}
          activeRegionKey={hoverRegion?.mapIndex === mapIndex ? hoverRegion.region.regionId : null}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onClick={handleClick}
        />
      ))}
      <HoverTooltip hoverRegion={hoverRegion} cursor={cursor} />
      <PinnedTooltipList pinned={pinned} />
    </div>
  )
}
