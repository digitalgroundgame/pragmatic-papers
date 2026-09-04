import { describe, expect, it } from "vitest"

import { mapAssetPublicPath, resolveDrilldownMap } from "@/blocks/InteractiveMap/adapters/drilldown"

const overviewSvg = `<svg viewBox="0 0 10 10"><script>bad()</script><g transform="scale(1,-1) translate(0,-10)">
  <path id="a" data-region-label="Alpha" data-seats="3" d="M0 0L1 1"/>
  <path id="a1" data-parent-id="a" d="M0 0L2 2"/>
</g></svg>`

describe("resolveDrilldownMap", () => {
  it("sanitizes and parses the overview, builds the index and child asset URLs", () => {
    const resolved = resolveDrilldownMap({
      overviewSvg,
      regionAssets: [{ regionId: "a", filename: "ca 8.svg" }],
    })
    expect(resolved.overview.paths).toHaveLength(2)
    expect(resolved.overview.flipY).toBe(true)
    expect(resolved.regions.topLevel).toEqual(["a"])
    expect(resolved.regions.childrenOf.a).toEqual(["a1"])
    expect(resolved.childAssets).toEqual([{ regionId: "a", url: "/map-assets/ca%208.svg" }])
    expect(resolved.problems).toEqual([])
  })

  it("reports assets pinned to unknown regions, unpopulated uploads and duplicates", () => {
    const resolved = resolveDrilldownMap({
      overviewSvg,
      regionAssets: [
        { regionId: "zzz", filename: "z.svg" },
        { regionId: "a", filename: null },
        { regionId: "a", filename: "one.svg" },
        { regionId: "a", filename: "two.svg" },
        { regionId: "  ", filename: "blank.svg" },
      ],
    })
    expect(resolved.childAssets).toEqual([{ regionId: "a", url: "/map-assets/one.svg" }])
    expect(resolved.problems).toEqual([
      expect.stringMatching(/"zzz" matches no path/),
      expect.stringMatching(/"a" is not populated/),
      expect.stringMatching(/"a" has more than one asset/),
    ])
  })

  it("flags a missing viewBox and a broken payload as problems but still resolves", () => {
    const resolved = resolveDrilldownMap({
      overviewSvg: `<svg><metadata>{nope</metadata><path id="a" d="M0 0"/></svg>`,
      regionAssets: [],
    })
    expect(resolved.problems).toEqual([
      expect.stringMatching(/overview <metadata>/),
      "overview has no usable viewBox",
    ])
    expect(resolved.regions.topLevel).toEqual(["a"])
  })

  it("mapAssetPublicPath is same-origin and URL-safe", () => {
    expect(mapAssetPublicPath("national (v2).svg")).toBe("/map-assets/national%20(v2).svg")
  })
})
