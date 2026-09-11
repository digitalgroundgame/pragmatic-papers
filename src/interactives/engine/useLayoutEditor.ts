"use client"

import { useEffect } from "react"

import type { MapStage } from "./stage"

/**
 * Whether the reader has asked to drag the map's furniture around.
 *
 * Anchors and inset offsets are code — checked into `anchors.json` and `offsets.json`,
 * measured against the geometry beside them — so moving one has meant guessing numbers,
 * reloading, and guessing again. This makes the map the tool: drag, and what it prints is what
 * the file wants.
 *
 * The query is the whole gate. It keeps a reader who did not ask from meeting a map whose
 * furniture slides around under the pointer, and that is all it is for.
 */
export function useLayoutEditor(stage: MapStage | null, enabled: boolean): void {
  useEffect(() => {
    if (!stage || !enabled) return
    stage.setLayoutEditing(true)
    // The console is the whole interface. Anything cleverer would be a feature to maintain,
    // and this is a ruler.
    const expose = (name: string, read: () => string): void => {
      ;(window as unknown as Record<string, unknown>)[name] = (): string => {
        const json = read()
        // eslint-disable-next-line no-console -- printing is what this tool is
        console.info(json)
        return json
      }
    }
    expose("drilldownAnchors", () => stage.movedAnchorsJSON())
    expose("drilldownOffsets", () => stage.movedRegionsJSON())
    // eslint-disable-next-line no-console -- printing is what this tool is
    console.info(
      "[interactive-map] layout editing on. Drag a seat block, or a region's shape. " +
        "`drilldownAnchors()` prints the blocks for geometry/anchors.json; " +
        "`drilldownOffsets()` prints the shapes for geometry/offsets.json.",
    )
    return () => {
      stage.setLayoutEditing(false)
      delete (window as unknown as Record<string, unknown>).drilldownAnchors
      delete (window as unknown as Record<string, unknown>).drilldownOffsets
    }
  }, [stage, enabled])
}
