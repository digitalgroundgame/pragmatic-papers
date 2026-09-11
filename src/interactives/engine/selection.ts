"use client"

import { createContext, useContext } from "react"

/**
 * How a slot rendered inside the drilldown reaches the map's selection.
 *
 * The engine takes an arbitrary `summary` node from whoever mounts it, so that node cannot be
 * given props directly. This is the seam: the client publishes `select`, and a summary can
 * hand the reader from an overview of the whole dataset straight to the region it names.
 */
export interface DrilldownSelection {
  /** Currently selected region id, or null. */
  selected: string | null
  /** Select a region, drilling into its parent first when it is a child. */
  select(regionId: string): void
}

const DrilldownSelectionContext = createContext<DrilldownSelection | null>(null)

export const DrilldownSelectionProvider = DrilldownSelectionContext.Provider

/** Null outside a drilldown, so a summary can also render standalone (tests, a preview). */
export function useDrilldownSelection(): DrilldownSelection | null {
  return useContext(DrilldownSelectionContext)
}
