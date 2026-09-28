import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DrilldownSelector } from "../DrilldownSelector"
import type { RegionIndex } from "../types"

// Two expandable regions (one with listed children, one drillable) and a leaf.
const regions = {
  byId: {
    north: { id: "north", label: "North" },
    south: { id: "south", label: "South" },
    leaf: { id: "leaf", label: "Leaf" },
    "north-1": { id: "north-1", label: "North One" },
  },
  topLevel: ["north", "south", "leaf"],
  childrenOf: { north: ["north-1"] },
} as unknown as RegionIndex

const onSelect = vi.fn()
const onToggle = vi.fn()
const onBack = vi.fn()

const renderSelector = (expanded: string | null = null) =>
  render(
    <DrilldownSelector
      regions={regions}
      view={{ parentId: null }}
      selected={null}
      drillable={new Set(["south"])}
      expanded={expanded}
      onSelect={onSelect}
      onToggle={onToggle}
      onBack={onBack}
    />,
  )

const item = (id: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`button[data-region-item="${id}"]`)!

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("DrilldownSelector keyboard", () => {
  it("walks the regions with the arrow keys, wrapping at both ends, and Home/End", () => {
    renderSelector()
    item("north").focus()
    fireEvent.keyDown(item("north"), { key: "ArrowDown" })
    expect(item("south")).toHaveFocus()
    fireEvent.keyDown(item("south"), { key: "End" })
    expect(item("leaf")).toHaveFocus()
    fireEvent.keyDown(item("leaf"), { key: "ArrowDown" })
    expect(item("north")).toHaveFocus()
    fireEvent.keyDown(item("north"), { key: "ArrowUp" })
    expect(item("leaf")).toHaveFocus()
    fireEvent.keyDown(item("leaf"), { key: "Home" })
    expect(item("north")).toHaveFocus()
  })

  it("expands a collapsed region with ArrowRight, whether it has listed children or drills", () => {
    renderSelector()
    item("north").focus()
    fireEvent.keyDown(item("north"), { key: "ArrowRight" })
    expect(onToggle).toHaveBeenLastCalledWith("north")
    item("south").focus()
    fireEvent.keyDown(item("south"), { key: "ArrowRight" })
    expect(onToggle).toHaveBeenLastCalledWith("south")
  })

  it("ignores ArrowRight on a leaf and on a region that is already open", () => {
    renderSelector("north")
    item("leaf").focus()
    fireEvent.keyDown(item("leaf"), { key: "ArrowRight" })
    item("north").focus()
    fireEvent.keyDown(item("north"), { key: "ArrowRight" })
    expect(onToggle).not.toHaveBeenCalled()
  })

  it("collapses an open region with ArrowLeft, and ignores it on a closed one", () => {
    renderSelector("north")
    item("south").focus()
    fireEvent.keyDown(item("south"), { key: "ArrowLeft" })
    expect(onToggle).not.toHaveBeenCalled()
    item("north").focus()
    fireEvent.keyDown(item("north"), { key: "ArrowLeft" })
    expect(onToggle).toHaveBeenCalledWith("north")
  })

  it("walks into an open region's children", () => {
    renderSelector("north")
    item("north").focus()
    fireEvent.keyDown(item("north"), { key: "ArrowDown" })
    expect(item("north-1")).toHaveFocus()
  })

  it("keeps one tab stop: only the active region is tabbable", () => {
    renderSelector()
    const tabbable = Array.from(document.querySelectorAll("button[data-region-item]")).filter(
      (b) => b.getAttribute("tabindex") === "0",
    )
    expect(tabbable).toEqual([item("north")])
  })

  it("ignores other keys", () => {
    renderSelector()
    item("north").focus()
    fireEvent.keyDown(item("north"), { key: "a" })
    expect(item("north")).toHaveFocus()
    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe("DrilldownSelector selection", () => {
  it("tells a pointer click from a keyboard activation", () => {
    renderSelector()
    fireEvent.click(item("leaf"), { detail: 1 })
    expect(onSelect).toHaveBeenLastCalledWith("leaf", "pointer")
    fireEvent.click(item("leaf"), { detail: 0 })
    expect(onSelect).toHaveBeenLastCalledWith("leaf", "keyboard")
  })
})

describe("DrilldownSelector branches", () => {
  it("keeps a collapsing branch mounted until its closing animation ends", () => {
    vi.useFakeTimers()
    const { rerender } = renderSelector("north")
    expect(screen.getByText("North One")).toBeInTheDocument()
    rerender(
      <DrilldownSelector
        regions={regions}
        view={{ parentId: null }}
        selected={null}
        drillable={new Set(["south"])}
        expanded={null}
        onSelect={onSelect}
        onToggle={onToggle}
        onBack={onBack}
      />,
    )
    expect(document.querySelector("[data-drilldown-branch='closing']")).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(220))
    expect(screen.queryByText("North One")).not.toBeInTheDocument()
  })
})
