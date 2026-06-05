import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createArticle, validateWriters } from "../articles"
import { createMapAssetFromFixture } from "../mapAssets"
import { createHeadingNode, createParagraph, createRichText } from "../richtext"

// Margins are R+ when positive, D+ when negative — extracted from Emily's demo HTML.
// Source: Redistricting Data Hub (left map, 119th) + UCLA cdmaps (right map, 120th).
const districtRegions119 = [
  { regionId: "MO-01", label: "MO 1st District", value: -58.18 },
  { regionId: "MO-02", label: "MO 2nd District", value: 8.08 },
  { regionId: "MO-03", label: "MO 3rd District", value: 27.16 },
  { regionId: "MO-04", label: "MO 4th District", value: 42.74 },
  { regionId: "MO-05", label: "MO 5th District", value: -23.6 },
  { regionId: "MO-06", label: "MO 6th District", value: 39.34 },
  { regionId: "MO-07", label: "MO 7th District", value: 43.14 },
  { regionId: "MO-08", label: "MO 8th District", value: 54.57 },
]

interface MapEntry {
  title: string
  svgAssetId: number
  regionAttribute: string
  regions: typeof districtRegions119
}

const createInteractiveMapNode = (maps: MapEntry[]) => ({
  type: "block",
  fields: {
    blockType: "interactiveMap",
    widgetTitle: "Missouri Congressional Districts — 119th vs. 120th Congress",
    layout: "row",
    colorScale: "divergingRedBlue",
    maps: maps.map((m) => ({
      title: m.title,
      svgAsset: m.svgAssetId,
      regionAttribute: m.regionAttribute,
      regions: m.regions,
    })),
    sources: [
      {
        link: {
          type: "custom",
          label: "Redistricting Data Hub",
          url: "https://redistrictingdatahub.org/",
          newTab: true,
          variant: "link",
        },
      },
      {
        link: {
          type: "custom",
          label: "UCLA cdmaps",
          url: "https://cdmaps.polisci.ucla.edu/",
          newTab: true,
          variant: "link",
        },
      },
    ],
  },
  format: "",
  version: 2,
})

const districtRegions120 = [
  { regionId: "MO-01", label: "MO 1st District", value: -58.61 },
  { regionId: "MO-02", label: "MO 2nd District", value: 11.69 },
  { regionId: "MO-03", label: "MO 3rd District", value: 20.49 },
  { regionId: "MO-04", label: "MO 4th District", value: 21.6 },
  { regionId: "MO-05", label: "MO 5th District", value: 18.19 },
  { regionId: "MO-06", label: "MO 6th District", value: 26.99 },
  { regionId: "MO-07", label: "MO 7th District", value: 43.14 },
  { regionId: "MO-08", label: "MO 8th District", value: 54.55 },
]

export const createInteractiveMapArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  validateWriters(writers)

  const writer = writers[0]!
  const title = "Missouri's Shifting Margins: The 119th and 120th Congressional Maps"

  const [asset119, asset120] = await Promise.all([
    createMapAssetFromFixture(
      payload,
      "mo-districts-119.svg",
      "Missouri Congressional Districts — 119th Congress",
      "https://redistrictingdatahub.org/",
    ),
    createMapAssetFromFixture(
      payload,
      "mo-districts-120.svg",
      "Missouri Congressional Districts — 120th Congress",
      "https://cdmaps.polisci.ucla.edu/",
    ),
  ])

  const article = await createArticle(payload, {
    title,
    content: createRichText([
      createParagraph(
        "The Interactive Map block renders pre-projected SVG maps side by side with hover tooltips, a shared color scale, and a source attribution footer. This article uses the same Missouri congressional districts Emily prepared for her election analysis.",
      ),
      createHeadingNode("Comparing 119th and 120th Congress Margins", "h2"),
      createParagraph(
        "Hover (or focus with the keyboard) over any district to see the R+/D+ margin. The diverging Red/Blue palette colors each region by its signed margin — deep red for strong Republican wins, deep blue for strong Democratic wins.",
      ),
      createInteractiveMapNode([
        {
          title: "119th Congress",
          svgAssetId: asset119.id,
          regionAttribute: "data-district",
          regions: districtRegions119,
        },
        {
          title: "120th Congress",
          svgAssetId: asset120.id,
          regionAttribute: "data-district",
          regions: districtRegions120,
        },
      ]),
      createHeadingNode("How the block works", "h2"),
      createParagraph(
        "Writers upload a pre-projected SVG (here in Albers Equal Area, ESRI:102003) into the Map Assets collection. Each path carries a region attribute (in this case data-district) that joins to a regions table the writer fills in with values and labels. The block reads the SVG content the collection captured at upload time, sanitizes it, parses out the paths, applies the color scale, and renders them as real JSX — so the colored map is SSR-friendly and accessible.",
      ),
    ]),
    authors: [writer.id],
    topics,
    slug: "missouri-shifting-margins-119-120-congressional-maps",
    heroImage: mediaDocs[2]?.id ?? mediaDocs[0]?.id,
    meta: {
      title,
      description:
        "A seeded article demonstrating the Interactive Map block with side-by-side Missouri congressional district maps for the 119th and 120th Congresses.",
      image: mediaDocs[2]?.id ?? mediaDocs[0]?.id,
    },
  })

  return article.id
}
