import { readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { resolveDrilldownMap } from "@/blocks/InteractiveMap/adapters/drilldown"
import { createUser, getPayload } from "../helpers/testUsers"

const FIXTURE = path.join(process.cwd(), "src/endpoints/seed/fixtures/federal-courts/national.svg")

describe("map-assets — large drilldown overview upload", () => {
  it("accepts a ~780 KB SVG and round-trips its text through svgContent", async () => {
    const payload = await getPayload()
    const editor = await createUser("editor")
    const data = await readFile(FIXTURE)
    expect(data.byteLength).toBeGreaterThan(700_000) // the old 500,000 cap would have rejected it

    const doc = await payload.create({
      collection: "map-assets",
      user: editor,
      overrideAccess: false,
      data: {
        label: "Federal courts — national overview",
        source: { type: "custom", url: "https://www.fjc.gov/history/judges" },
      },
      file: {
        name: `national-${Date.now()}.svg`,
        data,
        mimetype: "image/svg+xml",
        size: data.byteLength,
      },
    })

    expect(doc.svgContent).toBe(data.toString("utf8"))
    expect(doc.mimeType).toBe("image/svg+xml")

    // What the block will see: the whole hierarchy, the payload, and same-origin child URLs.
    const resolved = resolveDrilldownMap({
      overviewSvg: doc.svgContent ?? "",
      regionAssets: [{ regionId: "ca8", filename: doc.filename ?? "x.svg" }],
    })
    expect(resolved.problems).toEqual([])
    expect(resolved.overview.paths).toHaveLength(106)
    expect(resolved.regions.topLevel).toHaveLength(14)
    expect(resolved.regions.childrenOf.ca8).toHaveLength(10)
    expect(resolved.overview.payload?.records?.items.length).toBeGreaterThan(0)
    expect(resolved.childAssets[0]?.url).toMatch(/^\/map-assets\//)
  })
})
