import { describe, expect, it } from "vitest"

import { blockIdsFor } from "@/interactives/engine/DrilldownMapClient"
import type { DrilldownAsset, RegionIndex } from "@/interactives/engine/types"

/** Two circuits: one with a map of its own, one whose children are drawn on the national map. */
const regions = {
  byId: {},
  childrenOf: { ca9: ["akd", "hid"], cafc: ["cit", "uscfc"] },
  topLevel: ["ca9", "cafc"],
} as unknown as RegionIndex

const withShapes = { paths: [{ id: "akd", d: "M0 0L1 1" }] } as unknown as DrilldownAsset
const noShapes = { paths: [] } as unknown as DrilldownAsset

describe("blockIdsFor", () => {
  it("draws only the top level on the overview", () => {
    // The Federal Circuit's feeders wait for it to be opened, like any other region's children.
    expect(blockIdsFor({ parentId: null }, regions, {})).toEqual(["ca9", "cafc"])
  })

  it("on a region's own map, the region leads its children", () => {
    expect(blockIdsFor({ parentId: "ca9" }, regions, { ca9: withShapes })).toEqual([
      "ca9",
      "akd",
      "hid",
    ])
  })

  it("a region with no shapes keeps the overview, and its children join it there", () => {
    // Nothing has moved, so every top-level block is still on screen and must stay drawn.
    expect(blockIdsFor({ parentId: "cafc" }, regions, { cafc: noShapes })).toEqual([
      "ca9",
      "cafc",
      "cit",
      "uscfc",
    ])
  })
})
