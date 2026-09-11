import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { MapStage } from "@/interactives/engine/stage"
import { DEBUG_LAYOUT, DEBUG_PARAM, LAYOUT_TOOL_NOTES } from "@/interactives/engine/layoutTools"
import { useLayoutEditor } from "@/interactives/engine/useLayoutEditor"

function fakeStage(): { stage: MapStage; setLayoutEditing: ReturnType<typeof vi.fn> } {
  const setLayoutEditing = vi.fn()
  const stage = {
    setLayoutEditing,
    // Grouped by the map the drag happened on, as the real one is.
    movedAnchorsJSON: () => '{"overview":{"ca9":[1,2]}}',
    movedRegionsJSON: () => '{"overview":{"akd":[3,4]}}',
  } as unknown as MapStage
  return { stage, setLayoutEditing }
}

const helper = (name: string): (() => string) | undefined =>
  (window as unknown as Record<string, (() => string) | undefined>)[name]

describe("useLayoutEditor", () => {
  it("does nothing at all without the query", () => {
    const { stage, setLayoutEditing } = fakeStage()
    renderHook(() => useLayoutEditor(stage, false))
    expect(setLayoutEditing).not.toHaveBeenCalled()
    expect(helper("drilldownAnchors")).toBeUndefined()
  })

  it("turns on for anyone who asks, and hands them both dumps", () => {
    const { stage, setLayoutEditing } = fakeStage()
    renderHook(() => useLayoutEditor(stage, true))
    expect(setLayoutEditing).toHaveBeenCalledWith(true)
    expect(helper("drilldownAnchors")?.()).toBe('{"overview":{"ca9":[1,2]}}')
    expect(helper("drilldownOffsets")?.()).toBe('{"overview":{"akd":[3,4]}}')
  })

  it("puts the map back when it goes away", () => {
    const { stage, setLayoutEditing } = fakeStage()
    const { unmount } = renderHook(() => useLayoutEditor(stage, true))
    unmount()
    expect(setLayoutEditing).toHaveBeenLastCalledWith(false)
    expect(helper("drilldownAnchors")).toBeUndefined()
    expect(helper("drilldownOffsets")).toBeUndefined()
  })

  it("documents itself with the query it actually watches for", () => {
    // The footer prints these, so a note naming a different switch would be worse than none.
    expect(LAYOUT_TOOL_NOTES.map((note) => String(note.value)).join(" ")).toContain(
      `?${DEBUG_PARAM}=${DEBUG_LAYOUT}`,
    )
  })
})
