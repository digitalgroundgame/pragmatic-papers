// @vitest-environment node
import { describe, expect, it } from "vitest"

import type { MapAsset } from "@/payload-types"
import { interactiveMapBlock } from "@/stories/fixtures/blocks"
import { feedContext } from "@/stories/fixtures/feedContext"
import { mediaFixture } from "@/stories/fixtures/media"

import {
  interactiveMapAlt,
  interactiveMapToHTML,
  interactiveMapToImage,
  interactiveMapToSVG,
} from "../converters"

describe("interactiveMapToHTML", () => {
  it("links back to the page the map sits on, naming the map", () => {
    expect(interactiveMapToHTML(interactiveMapBlock, feedContext())).toMatchInlineSnapshot(
      `"<p><a href="https://example.org/articles/example-article">View the interactive map “Missouri congressional districts” on The Pragmatic Papers →</a></p>"`,
    )
  })

  it("leaves the title out when the map has none", () => {
    expect(interactiveMapToHTML({ widgetTitle: null }, feedContext())).toMatchInlineSnapshot(
      `"<p><a href="https://example.org/articles/example-article">View the interactive map on The Pragmatic Papers →</a></p>"`,
    )
  })

  it("escapes the title", () => {
    expect(interactiveMapToHTML({ widgetTitle: "R&D <maps>" }, feedContext())).toContain(
      "“R&amp;D &lt;maps&gt;”",
    )
  })
})

describe("interactiveMapToImage", () => {
  const feedImage = mediaFixture({
    id: 7,
    alt: "Map: Missouri congressional districts",
    url: "/media/interactive-map-0123456789abcdef.webp",
    width: 1360,
    height: 1128,
  })

  it("shows the stored picture, captioned with a link to the interactive version", () => {
    expect(
      interactiveMapToImage({ ...interactiveMapBlock, feedImage }, feedContext()),
    ).toMatchInlineSnapshot(
      `"<figure><img src="https://example.org/media/interactive-map-0123456789abcdef.webp" alt="Map: Missouri congressional districts" width="1360" height="1128" /><figcaption><a href="https://example.org/articles/example-article">View the interactive version on The Pragmatic Papers</a></figcaption></figure>"`,
    )
  })

  it("describes the map itself when the picture has no alt text, escaped", () => {
    const html = interactiveMapToImage(
      {
        ...interactiveMapBlock,
        widgetTitle: 'Turnout "2024" <draft>',
        feedImage: { ...feedImage, alt: "" },
      },
      feedContext(),
    )
    expect(html).toContain('alt="Map: Turnout &quot;2024&quot; &lt;draft&gt;"')
  })

  it.each([
    ["has no picture yet", undefined],
    ["has a picture that wasn't loaded", 7],
    ["has a picture with no file", { ...feedImage, url: null }],
  ])("falls back to the link when the map %s", (_label, image) => {
    expect(
      interactiveMapToImage({ ...interactiveMapBlock, feedImage: image as never }, feedContext()),
    ).toBe(interactiveMapToHTML(interactiveMapBlock, feedContext()))
  })
})

describe("interactiveMapAlt", () => {
  it("names the widget", () => {
    expect(interactiveMapAlt(interactiveMapBlock)).toBe("Map: Missouri congressional districts")
  })

  it("names the maps when the widget has no title", () => {
    expect(
      interactiveMapAlt({
        ...interactiveMapBlock,
        widgetTitle: " ",
        maps: [
          { title: "119th Congress", svgAsset: 1 },
          { title: null, svgAsset: 2 },
          { title: "120th Congress", svgAsset: 3 },
        ],
      }),
    ).toBe("Map: 119th Congress, 120th Congress")
  })

  it("says only that it's a map when nothing is titled", () => {
    expect(interactiveMapAlt({ ...interactiveMapBlock, widgetTitle: null, maps: [] })).toBe("Map")
  })
})

const asset = (id: number, svgContent: string): MapAsset => ({
  id,
  svgContent,
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
})

// A 200×100 map: a Democratic district, a Republican one, a toss-up, and an outline with
// no id, which keeps its own attributes.
const DISTRICTS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g transform="scale(1,-1)">
  <path id="A" data-margin="-40" d="M0 0H50V100H0Z"/>
  <path id="B" data-margin="12" d="M50 0H100V100H50Z"/>
  <path id="C" data-margin="0.4" d="M100 0H200V100H100Z"/>
  <path fill="none" stroke="#000" d="M0 0H200V100H0Z"/>
</g></svg>`

describe("interactiveMapToSVG", () => {
  const block = {
    ...interactiveMapBlock,
    widgetTitle: "Districts & margins",
    maps: [{ title: "2024", svgAsset: asset(1, DISTRICTS), dataAttribute: "data-margin" }],
  }

  it("draws the title, the shaded map and the legend as one standalone SVG", () => {
    expect(interactiveMapToSVG(block)).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg" width="1360" height="928" viewBox="0 0 680 464" font-family="Geist, 'DejaVu Sans', Helvetica, Arial, sans-serif"><rect width="680" height="464" fill="#ffffff" /><text x="340" y="34" font-size="18" font-weight="600" fill="#171717" text-anchor="middle">Districts &amp; margins</text><text x="340" y="66" font-size="14" font-weight="500" fill="#171717" text-anchor="middle">2024</text><svg x="16" y="78" width="648" height="324" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet"><g transform="scale(1,-1)"><path d="M0 0H50V100H0Z" fill="#126ace" stroke="#ffffff" stroke-width="1" vector-effect="non-scaling-stroke" /><path d="M50 0H100V100H50Z" fill="#f48088" stroke="#ffffff" stroke-width="1" vector-effect="non-scaling-stroke" /><path d="M100 0H200V100H100Z" fill="#f2efe9" stroke="#ffffff" stroke-width="1" vector-effect="non-scaling-stroke" /><path d="M0 0H200V100H0Z" fill="none" stroke="#000" /></g></svg><rect x="16" y="414" width="68.44" height="16" rx="2" fill="#126ace" /><text x="50.22" y="443" font-size="11" fill="#525252" text-anchor="middle">≥D+30</text><rect x="88.44" y="414" width="68.44" height="16" rx="2" fill="#2c86ed" /><text x="122.67" y="443" font-size="11" fill="#525252" text-anchor="middle">≥D+15</text><rect x="160.89" y="414" width="68.44" height="16" rx="2" fill="#72aef3" /><text x="195.11" y="443" font-size="11" fill="#525252" text-anchor="middle">≥D+5</text><rect x="233.33" y="414" width="68.44" height="16" rx="2" fill="#b4d4f8" /><text x="267.56" y="443" font-size="11" fill="#525252" text-anchor="middle">≥D+1</text><rect x="305.78" y="414" width="68.44" height="16" rx="2" fill="#f2efe9" /><text x="340" y="443" font-size="11" fill="#525252" text-anchor="middle">±1</text><rect x="378.22" y="414" width="68.44" height="16" rx="2" fill="#ffb8bc" /><text x="412.44" y="443" font-size="11" fill="#525252" text-anchor="middle">≥R+1</text><rect x="450.67" y="414" width="68.44" height="16" rx="2" fill="#f48088" /><text x="484.89" y="443" font-size="11" fill="#525252" text-anchor="middle">≥R+5</text><rect x="523.11" y="414" width="68.44" height="16" rx="2" fill="#e54858" /><text x="557.33" y="443" font-size="11" fill="#525252" text-anchor="middle">≥R+15</text><rect x="595.56" y="414" width="68.44" height="16" rx="2" fill="#d81334" /><text x="629.78" y="443" font-size="11" fill="#525252" text-anchor="middle">≥R+30</text></svg>"`,
    )
  })

  it("shades each region as the page does, in plain colors", () => {
    const svg = interactiveMapToSVG(block)!
    // D+40, R+12 and a toss-up: the scale's own fallbacks, with no var() or oklch() left
    // for the rasterizer to trip on.
    expect(svg).toContain('d="M0 0H50V100H0Z" fill="#126ace"')
    expect(svg).toContain('d="M50 0H100V100H50Z" fill="#f48088"')
    expect(svg).toContain('d="M100 0H200V100H100Z" fill="#f2efe9"')
    expect(svg).not.toMatch(/var\(|oklch\(/)
  })

  it("applies overrides and the per-map inversion", () => {
    const svg = interactiveMapToSVG({
      ...block,
      maps: [
        {
          ...block.maps[0]!,
          invertColors: true,
          overrides: [{ regionId: "B", color: "gold" }],
        },
      ],
    })!
    expect(svg).toContain('d="M0 0H50V100H0Z" fill="#d81334"')
    expect(svg).toContain('d="M50 0H100V100H50Z" fill="gold"')
    expect(svg).toContain(">2024 (Inverted)</text>")
  })

  it("sets maps side by side in a row, and one under another when stacked", () => {
    const maps = [block.maps[0]!, { ...block.maps[0]!, title: "2026" }]
    const mapBoxes = (svg: string) =>
      [...svg.matchAll(/<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(
        ([, x, y, width, height]) => [x, y, width, height].map(Number),
      )

    expect(mapBoxes(interactiveMapToSVG({ ...block, layout: "row", maps })!)).toEqual([
      [16, 78, 318, 159],
      [346, 78, 318, 159],
    ])
    expect(mapBoxes(interactiveMapToSVG({ ...block, layout: "stacked", maps })!)).toEqual([
      [16, 78, 648, 324],
      [16, 440, 648, 324],
    ])
  })

  it("leaves the legend off a map with per-region colors", () => {
    const svg = interactiveMapToSVG({ ...block, colorScale: "perRegion" })!
    expect(svg).not.toContain("<rect x=")
    expect(svg).not.toContain("≥R+")
  })

  it("wraps a long title onto more lines and makes room for them", () => {
    const long = "Missouri congressional districts before and after the mid-decade redistricting"
    const svg = interactiveMapToSVG({ ...block, widgetTitle: long })!
    expect(svg).toContain(">Missouri congressional districts before and after the</text>")
    expect(svg).toContain(">mid-decade redistricting</text>")
    const height = (markup: string) => Number(/viewBox="0 0 680 (\d+)"/.exec(markup)![1])
    expect(height(svg)).toBe(height(interactiveMapToSVG(block)!) + 24)
  })

  it("skips a map whose SVG wasn't loaded, and draws nothing when none was", () => {
    const unloaded = { title: "Unloaded", svgAsset: 9 }
    expect(interactiveMapToSVG({ ...block, maps: [unloaded, block.maps[0]!] })).not.toContain(
      "Unloaded",
    )
    expect(interactiveMapToSVG({ ...block, maps: [unloaded] })).toBeNull()
    expect(interactiveMapToSVG({ ...block, maps: [] })).toBeNull()
  })

  it("escapes what editors typed and drops a script the SVG carried", () => {
    const svg = interactiveMapToSVG({
      ...block,
      widgetTitle: "<script>alert(1)</script>",
      maps: [
        {
          title: "A & B",
          svgAsset: asset(2, DISTRICTS.replace("</g>", '<script>alert("x")</script></g>')),
        },
      ],
    })!
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(svg).toContain(">A &amp; B</text>")
    expect(svg).not.toContain("<script")
  })
})
