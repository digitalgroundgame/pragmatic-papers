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
  /**
   * `overlay`: the block's list beside the map (a wrapped row under `sm`).
   * `stacked`: the page's strip above the map — one scrolling row on phones, wrapping from `md`.
   */
  layout?: "overlay" | "stacked"
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
  layout,
}: {
  label: string
  selected: boolean
  tabbable: boolean
  onSelect(via: SelectVia): void
  regionId: string
  drillable: boolean
  layout: "overlay" | "stacked"
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
        "focus-visible:ring-ring/60 flex shrink-0 items-center gap-2 text-left whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
        layout === "stacked"
          ? "rounded-md px-3 py-1.5 text-sm font-medium"
          : "rounded-xs px-2 py-1 text-xs",
        selected
          ? "bg-foreground text-background hover:bg-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {drillable && layout === "stacked" && (
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
  layout = "overlay",
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
      data-layout={layout}
      onKeyDown={onKeyDown}
      className={cn(
        layout === "stacked"
          ? "flex flex-row items-center gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0"
          : "flex flex-row flex-wrap gap-1 sm:w-44 sm:shrink-0 sm:flex-col",
        className,
      )}
    >
      {parent && (
        <>
          <button
            type="button"
            data-drilldown-back=""
            onClick={onBack}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:ring-ring/60 shrink-0 text-left font-medium whitespace-nowrap outline-none focus-visible:ring-2",
              layout === "stacked"
                ? "rounded-md px-3 py-1.5 text-sm"
                : "rounded-xs px-2 py-1 text-xs",
            )}
          >
            ← Back to overview
          </button>
          <Item
            regionId={parent.id}
            label={parent.label}
            selected={selected === parent.id}
            tabbable={activeId === parent.id}
            drillable={false}
            layout={layout}
            onSelect={(via) => onSelect(parent.id, via)}
          />
          <div
            className={cn(
              "text-muted-foreground shrink-0 font-semibold tracking-wide uppercase",
              layout === "stacked"
                ? "self-center px-2 text-[11px] after:ml-1 after:content-['·']"
                : "mt-1 px-2 text-[10px]",
            )}
          >
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
            layout={layout}
            onSelect={(via) => onSelect(id, via)}
          />
        )
      })}
    </nav>
  )
}
