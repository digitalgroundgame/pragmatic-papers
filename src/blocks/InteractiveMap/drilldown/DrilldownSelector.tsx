"use client"

import React, { useRef } from "react"

import { cn } from "@/utilities/utils"

import type { RegionIndex } from "./types"

export type SelectVia = "pointer" | "keyboard"

interface DrilldownSelectorProps {
  regions: RegionIndex
  view: { parentId: string | null }
  selected: string | null
  drillable: Set<string>
  onSelect(regionId: string, via: SelectVia): void
  onBack(): void
  className?: string
}

const viaOf = (e: React.MouseEvent): SelectVia => (e.detail === 0 ? "keyboard" : "pointer")

function Item({
  label,
  selected,
  tabbable,
  onSelect,
  regionId,
  drillable,
}: {
  label: string
  selected: boolean
  tabbable: boolean
  onSelect(via: SelectVia): void
  regionId: string
  drillable: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      data-region-item={regionId}
      data-drillable={drillable ? "true" : undefined}
      aria-pressed={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={(e) => onSelect(viaOf(e))}
      className={cn(
        "focus-visible:ring-ring/60 flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
        selected
          ? "bg-foreground text-background hover:bg-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {drillable && (
        <span
          aria-hidden="true"
          className={cn("text-xs", selected ? "text-background/70" : "text-muted-foreground")}
        >
          ›
        </span>
      )}
    </button>
  )
}

/**
 * Lists the top-level regions, or — once drilled in — the parent and its children with a way
 * back. Selecting here highlights the matching shape and vice versa.
 *
 * One tab stop: the selected item (or the first) is tabbable and the arrow keys move focus
 * through the list, so a keyboard reader crosses 94 districts with one Tab, not 94.
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
  const navRef = useRef<HTMLElement | null>(null)
  const parent = view.parentId ? regions.byId[view.parentId] : null
  const ids = parent ? [parent.id, ...(regions.childrenOf[parent.id] ?? [])] : regions.topLevel
  const activeId = selected && ids.includes(selected) ? selected : ids[0]

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"]
    if (!keys.includes(e.key) || !navRef.current) return
    const items = Array.from(
      navRef.current.querySelectorAll<HTMLButtonElement>("button[data-region-item]"),
    )
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    if (idx < 0) return
    e.preventDefault()
    const forward = e.key === "ArrowDown" || e.key === "ArrowRight"
    const backward = e.key === "ArrowUp" || e.key === "ArrowLeft"
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : forward
            ? (idx + 1) % items.length
            : backward
              ? (idx - 1 + items.length) % items.length
              : idx
    items[next]?.focus()
  }

  return (
    <nav
      ref={navRef}
      aria-label="Regions"
      data-drilldown-selector=""
      onKeyDown={onKeyDown}
      className={cn(
        "flex flex-row items-center gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0",
        className,
      )}
    >
      {parent && (
        <>
          <button
            type="button"
            data-drilldown-back=""
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/60 shrink-0 rounded-md px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2"
          >
            ← Back to overview
          </button>
          <Item
            regionId={parent.id}
            label={parent.label}
            selected={selected === parent.id}
            tabbable={activeId === parent.id}
            drillable={false}
            onSelect={(via) => onSelect(parent.id, via)}
          />
          <div className="text-muted-foreground shrink-0 self-center px-2 text-[11px] font-semibold tracking-wide uppercase after:ml-1 after:content-['·']">
            {parent.childrenLabel ?? "Details"}
          </div>
        </>
      )}
      {(parent ? (regions.childrenOf[parent.id] ?? []) : ids).map((id) => {
        const region = regions.byId[id]
        if (!region) return null
        return (
          <Item
            key={id}
            regionId={id}
            label={region.label}
            selected={selected === id}
            tabbable={activeId === id}
            drillable={drillable.has(id)}
            onSelect={(via) => onSelect(id, via)}
          />
        )
      })}
    </nav>
  )
}
