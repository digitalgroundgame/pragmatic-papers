"use client"

import React from "react"

import { cn } from "@/utilities/utils"

import type { RegionIndex } from "./types"

interface DrilldownSelectorProps {
  regions: RegionIndex
  view: { parentId: string | null }
  selected: string | null
  drillable: Set<string>
  onSelect(regionId: string): void
  onBack(): void
  className?: string
}

function Item({
  label,
  selected,
  onClick,
  regionId,
  drillable,
}: {
  label: string
  selected: boolean
  onClick(): void
  regionId: string
  drillable: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      data-region-item={regionId}
      data-drillable={drillable ? "true" : undefined}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "hover:bg-muted rounded-xs px-2 py-1 text-left text-xs transition-colors",
        selected ? "bg-foreground text-background hover:bg-foreground" : "text-foreground",
      )}
    >
      {label}
    </button>
  )
}

/**
 * Lists the top-level regions, or — once drilled in — the parent and its children with a way
 * back. Selecting here highlights the matching shape and vice versa.
 */
export function DrilldownSelector({
  regions,
  view,
  selected,
  drillable,
  onSelect,
  onBack,
  className,
}: DrilldownSelectorProps): React.ReactElement {
  const parent = view.parentId ? regions.byId[view.parentId] : null
  const ids = parent ? (regions.childrenOf[parent.id] ?? []) : regions.topLevel
  return (
    <nav
      aria-label="Regions"
      data-drilldown-selector=""
      className={cn("flex flex-row flex-wrap gap-1 sm:w-44 sm:shrink-0 sm:flex-col", className)}
    >
      {parent && (
        <>
          <button
            type="button"
            data-drilldown-back=""
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground rounded-xs px-2 py-1 text-left text-xs font-medium"
          >
            ← Back to overview
          </button>
          <Item
            regionId={parent.id}
            label={parent.label}
            selected={selected === parent.id}
            drillable={false}
            onClick={() => onSelect(parent.id)}
          />
          <div className="text-muted-foreground mt-1 px-2 text-[10px] font-semibold tracking-wide uppercase">
            {parent.childrenLabel ?? "Details"}
          </div>
        </>
      )}
      {ids.map((id) => {
        const region = regions.byId[id]
        if (!region) return null
        return (
          <Item
            key={id}
            regionId={id}
            label={region.label}
            selected={selected === id}
            drillable={drillable.has(id)}
            onClick={() => onSelect(id)}
          />
        )
      })}
    </nav>
  )
}
