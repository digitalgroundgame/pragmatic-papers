"use client"

import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { cn } from "@/utilities/utils"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { regionGlyph } from "./icons"
import type { RegionIcons, RegionIndex } from "./types"

export type SelectVia = "pointer" | "keyboard"

interface DrilldownSelectorProps {
  regions: RegionIndex
  view: { parentId: string | null }
  selected: string | null
  drillable: Set<string>
  /** The one region showing its children, if any: the rail opens a single branch at a time. */
  expanded: string | null
  onSelect(regionId: string, via: SelectVia): void
  onToggle(regionId: string): void
  onBack(): void
  /** Record search, if the interactive has it: rides at the top of the rail, in its width. */
  search?: React.ReactNode
  /** What the profile puts beside a top-level region, if anything. */
  icons?: RegionIcons
  /** Folded to a column of glyphs: the top-level regions only, each named by a tooltip. */
  collapsed?: boolean
  /** Unfold the rail and put the reader in the search box — the folded column has no room. */
  onSearch?(): void
  className?: string
}

const viaOf = (e: React.MouseEvent): SelectVia => (e.detail === 0 ? "keyboard" : "pointer")

/**
 * The chosen region, as an inversion of the rail's own two colours. Not the active tint, which
 * is the same wash as hover and vanishes down a hundred rows; not `sidebar-primary`, which is
 * a blue, and blue on this page means a Democratic appointee.
 */
const ACTIVE_ROW =
  "data-active:bg-sidebar-foreground data-active:text-sidebar data-active:hover:bg-sidebar-foreground data-active:hover:text-sidebar"

/**
 * Both a region and its children are `button`s carrying `data-region-item`: the map, the
 * keyboard walk and the tests all find a row by that one attribute, whichever depth it sits at.
 */
const rowProps = (
  regionId: string,
  {
    label,
    selected,
    tabbable,
    titled = true,
  }: { label: string; selected: boolean; tabbable: boolean; titled?: boolean },
) => ({
  type: "button" as const,
  "data-region-item": regionId,
  "aria-pressed": selected,
  tabIndex: tabbable ? 0 : -1,
  // The rail is sized for most names and this is how a reader gets the rest. Top-level rows
  // use a tooltip instead: folded, they are a glyph with no name showing at all.
  title: titled ? label : undefined,
})

/** Long enough to read as a movement, short enough not to be waited on. */
const BRANCH_MS = 220

/**
 * A branch that grows and shrinks rather than appearing and vanishing, so a reader opening a
 * second circuit can see where the list that arrived came from — which is why a closing branch
 * stays mounted until its transition is over. `grid-template-rows: 0fr → 1fr` animates to a
 * height nobody has measured, and a branch that mounts open spends its first frame closed.
 */
function Branch({
  open,
  className,
  children,
}: {
  open: boolean
  className?: string
  children: React.ReactNode
}): React.ReactNode {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(open))
    return () => cancelAnimationFrame(frame)
  }, [open])
  return (
    <div
      data-drilldown-branch={open ? "open" : "closing"}
      // A branch on its way out is a picture of where the reader has been, not a place to go.
      inert={!open || undefined}
      className={cn(
        // Duration and easing sit inside the guard with the property: `transition-property`
        // defaults to `all`, so a bare `duration-200` animates this height regardless.
        "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out",
        grown && open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/**
 * The region rail: every top-level region down the left of the stage, each drillable one
 * opening to show its children in place. Built on the sidebar primitives, `collapsible="none"`
 * — this is a column beside a map, not an app shell — though the provider is still required.
 *
 * One tab stop: the selected item is tabbable and the arrow keys move focus through the
 * visible rows, so a keyboard reader crosses 94 districts with one Tab. Right/Left open and
 * close a region, as in any tree.
 */
export function DrilldownSelector({
  regions,
  view,
  selected,
  drillable,
  expanded,
  onSelect,
  onToggle,
  onBack,
  search,
  icons,
  collapsed = false,
  onSearch,
  className,
}: DrilldownSelectorProps): React.ReactElement {
  const navRef = useRef<HTMLDivElement | null>(null)
  // The branch that was open when this one was chosen, kept mounted while it shrinks away.
  const [previous, setPrevious] = useState(expanded)
  const [leaving, setLeaving] = useState<string | null>(null)
  if (previous !== expanded) {
    setPrevious(expanded)
    setLeaving(previous)
  }
  useEffect(() => {
    if (leaving === null) return
    const done = setTimeout(() => setLeaving(null), BRANCH_MS)
    return () => clearTimeout(done)
  }, [leaving])

  const childrenOf = (id: string): string[] => regions.childrenOf[id] ?? []
  const isExpandable = (id: string): boolean => drillable.has(id) || childrenOf(id).length > 0
  const visible: string[] = []
  for (const id of regions.topLevel) {
    visible.push(id)
    if (expanded === id) visible.push(...childrenOf(id))
  }
  const activeId = selected && visible.includes(selected) ? selected : visible[0]

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const nav = navRef.current
    if (!nav) return
    const items = Array.from(nav.querySelectorAll<HTMLButtonElement>("button[data-region-item]"))
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    if (idx < 0) return
    const id = items[idx]?.dataset.regionItem ?? ""
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if (!isExpandable(id) || (expanded === id) === (e.key === "ArrowRight")) return
      e.preventDefault()
      onToggle(id)
      return
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return
    e.preventDefault()
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : e.key === "ArrowDown"
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    // A header that stays put over a region list that scrolls under it. The list is the
    // scrolling element, so the search box needs no `sticky` and its results are not clipped.
    <SidebarProvider
      data-drilldown-rail=""
      // Folding is a state of this rail, not a second one: the rows stay and their names
      // collapse away, so the glyphs slide into the narrow column.
      data-collapsed={collapsed ? "" : undefined}
      // An in-page rail, not an app shell: never the viewport's height or the row's whole
      // width, and never taller than the stage beside it.
      className={cn("group/rail max-h-56 min-h-0 w-auto md:max-h-(--drilldown-stage-h)", className)}
    >
      {/* `h-auto`, not the sidebar's own `h-full`: the column is bounded by a max-height and
          nothing else, so a percentage height has nothing definite to resolve against and
          falls back to the content's own. Letting the flex row stretch it is what keeps the
          list inside the cap — and therefore scrolling. */}
      {/* The only tooltips here that are not the map's own: one wait for the first, none for
          the rest of a sweep down the column. */}
      <TooltipProvider delay={400} closeDelay={0}>
        <Sidebar collapsible="none" className="h-auto min-h-0 w-full bg-transparent">
          {search && (
            <SidebarHeader className="p-0 pb-2 group-data-[collapsed]/rail:hidden">
              {search}
            </SidebarHeader>
          )}
          {/* A search box needs a rail's width, so folded it is a glyph that gives one back. */}
          {search && onSearch && (
            <SidebarHeader className="hidden p-0 pb-1 group-data-[collapsed]/rail:block">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <SidebarMenuButton
                      type="button"
                      size="sm"
                      data-drilldown-search-open=""
                      aria-label="Search"
                      onClick={onSearch}
                      // The same square as a region row, so the glyph lands in the column
                      // they all share rather than a little to one side of it.
                      className="text-muted-foreground w-full p-1"
                    />
                  }
                >
                  <Search aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="right">Search</TooltipContent>
              </Tooltip>
            </SidebarHeader>
          )}
          {/* The full "Back to overview" row below carries its own name and is dropped when
              folded — the trail across the top of the map already says where the reader is.
              But the way *back* is not the same thing as the way *there*, and a folded column
              that can open eleven maps and close none of them is missing half its purpose. */}
          {view.parentId && (
            <SidebarHeader className="hidden p-0 pb-1 group-data-[collapsed]/rail:block">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <SidebarMenuButton
                      type="button"
                      size="sm"
                      data-drilldown-back-collapsed=""
                      aria-label="Back to overview"
                      onClick={onBack}
                      className="text-muted-foreground w-full p-1"
                    />
                  }
                >
                  <ChevronLeft aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="right">Back to overview</TooltipContent>
              </Tooltip>
            </SidebarHeader>
          )}
          <SidebarContent
            ref={navRef}
            role="navigation"
            aria-label="Regions"
            data-drilldown-selector=""
            onKeyDown={onKeyDown}
            // The registry's sidebar hides its scrollbar (`no-scrollbar`), and a rail that
            // scrolls should say so. Marked important rather than left to which of two equally
            // specific classes the stylesheet happens to print second.
            className="[scrollbar-width:thin]!"
          >
            <SidebarGroup className="p-0">
              {view.parentId && (
                <SidebarMenuButton
                  data-drilldown-back=""
                  onClick={onBack}
                  // Folded there is no room for it and no need either: the trail across the top
                  // of the map says where the reader is and takes them back up it.
                  className="text-muted-foreground mb-1 group-data-[collapsed]/rail:hidden"
                >
                  <ChevronLeft aria-hidden="true" />
                  <span>Back to overview</span>
                </SidebarMenuButton>
              )}
              <SidebarMenu>
                {regions.topLevel.map((id) => {
                  const region = regions.byId[id]
                  if (!region) return null
                  const open = expanded === id
                  const kids = open || leaving === id ? childrenOf(id) : []
                  const expandable = isExpandable(id)
                  return (
                    <SidebarMenuItem key={id}>
                      <Tooltip>
                        <SidebarMenuButton
                          {...rowProps(id, {
                            label: region.label,
                            selected: selected === id,
                            tabbable: activeId === id,
                            titled: false,
                          })}
                          size="sm"
                          data-drillable={expandable ? "true" : undefined}
                          aria-expanded={expandable ? expanded === id : undefined}
                          aria-label={region.label}
                          isActive={selected === id}
                          onClick={(e) => onSelect(id, viaOf(e))}
                          className={cn(
                            // Square once folded, at the row's own height: 4px around a 20px
                            // glyph is 28, which is what `h-7` already is. The padding does
                            // not change, so the column narrowing is the only movement.
                            "group-data-[collapsed]/rail:p-1",
                            ACTIVE_ROW,
                          )}
                          render={<TooltipTrigger render={<button type="button" />} />}
                        >
                          {regionGlyph(region, icons)}
                          {/* Not hidden when it folds — clipped. The row's own overflow takes
                              the name away as the column narrows over it, which is a movement
                              rather than a disappearance, and the glyph beside it never
                              shifts. */}
                          <span>{region.label}</span>
                        </SidebarMenuButton>
                        <TooltipContent side="right">{region.label}</TooltipContent>
                      </Tooltip>
                      {/* Not merely hidden when folded: an action still in the document keeps
                          its room reserved — the row reserves `pr-8` for one and `:has()` does
                          not care that it is `display: none` — and 40px of padding in a 36px
                          column pushes the button past the rail and scrolls it sideways. */}
                      {expandable && !collapsed && (
                        <SidebarMenuAction
                          data-region-toggle={id}
                          aria-label={`${expanded === id ? "Collapse" : "Expand"} ${region.label}`}
                          tabIndex={-1}
                          onClick={() => onToggle(id)}
                          // On the selected row the action is drawn on the inverted pill,
                          // where its own `sidebar-foreground` is the ground's colour.
                          className={cn(selected === id && "text-sidebar")}
                        >
                          <ChevronRight
                            aria-hidden="true"
                            className={cn("transition-transform", expanded === id && "rotate-90")}
                          />
                        </SidebarMenuAction>
                      )}
                      {kids.length > 0 && (
                        <Branch open={open} className="group-data-[collapsed]/rail:hidden">
                          <SidebarMenuSub>
                            {kids.map((childId) => {
                              const child = regions.byId[childId]
                              if (!child) return null
                              return (
                                <SidebarMenuSubItem key={childId}>
                                  <SidebarMenuSubButton
                                    render={
                                      <button
                                        {...rowProps(childId, {
                                          label: child.label,
                                          selected: selected === childId,
                                          tabbable: activeId === childId,
                                        })}
                                        onClick={(e) => onSelect(childId, viaOf(e))}
                                      />
                                    }
                                    isActive={selected === childId}
                                    className={ACTIVE_ROW}
                                  >
                                    <span>{child.label}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        </Branch>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </TooltipProvider>
    </SidebarProvider>
  )
}
