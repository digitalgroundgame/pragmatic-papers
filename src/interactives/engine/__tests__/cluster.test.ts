import { describe, expect, it } from "vitest"

import { type ClusterBox, layoutCluster } from "../cluster"

const box = (id: string, width: number, height = 10): ClusterBox => ({ id, width, height })
const spacing = { gap: 4, rowGap: 6, align: "left" as const }

/** Top-left of one member, which is all any of these assertions are about. */
const at = (
  placement: ReturnType<typeof layoutCluster>,
  id: string,
): readonly [number, number] | undefined => placement.at.get(id)

describe("layoutCluster", () => {
  it("runs a row left to right with the gap between each", () => {
    const out = layoutCluster([[box("a", 10), box("b", 20), box("c", 5)]], spacing)
    expect(at(out, "a")).toEqual([0, 0])
    expect(at(out, "b")).toEqual([14, 0])
    expect(at(out, "c")).toEqual([38, 0])
    // 10 + 20 + 5, and two gaps between the three.
    expect(out.width).toBe(43)
    expect(out.height).toBe(10)
  })

  it("stacks rows by the tallest member in each, plus the row gap", () => {
    const out = layoutCluster([[box("a", 10, 8)], [box("b", 10, 20)], [box("c", 10, 5)]], spacing)
    expect(at(out, "a")?.[1]).toBe(0)
    expect(at(out, "b")?.[1]).toBe(14)
    expect(at(out, "c")?.[1]).toBe(40)
    expect(out.height).toBe(45)
  })

  it("centres a row's members on each other rather than on their tops", () => {
    const out = layoutCluster([[box("tall", 10, 30), box("short", 10, 10)]], spacing)
    expect(at(out, "tall")?.[1]).toBe(0)
    expect(at(out, "short")?.[1]).toBe(10)
  })

  it("aligns a narrow row against the widest one", () => {
    const rows = [[box("solo", 20)], [box("a", 20), box("b", 20)]]
    expect(at(layoutCluster(rows, { ...spacing, align: "left" }), "solo")).toEqual([0, 0])
    expect(at(layoutCluster(rows, { ...spacing, align: "center" }), "solo")).toEqual([12, 0])
    // What the Supreme Court does over the three courts beneath it: same right-hand edge.
    expect(at(layoutCluster(rows, { ...spacing, align: "right" }), "solo")).toEqual([24, 0])
  })

  it("is unmoved by a row with nothing in it", () => {
    const withGap = layoutCluster([[box("a", 10)], [], [box("b", 10)]], spacing)
    const without = layoutCluster([[box("a", 10)], [box("b", 10)]], spacing)
    expect(at(withGap, "b")).toEqual(at(without, "b"))
    expect(withGap.height).toBe(without.height)
  })

  it("has no size when there is nothing to place", () => {
    const out = layoutCluster([], spacing)
    expect(out.at.size).toBe(0)
    expect(out.width).toBe(0)
    expect(out.height).toBe(0)
  })

  it("scales with the gap, which is how the group holds its shape as the map shrinks", () => {
    const rows = [[box("a", 10), box("b", 10)]]
    const wide = layoutCluster(rows, { ...spacing, gap: 40 })
    const narrow = layoutCluster(rows, { ...spacing, gap: 4 })
    expect(at(wide, "b")?.[0]).toBe(50)
    expect(at(narrow, "b")?.[0]).toBe(14)
  })
})
