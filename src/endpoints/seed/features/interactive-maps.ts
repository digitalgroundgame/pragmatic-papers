import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createArticle, validateWriters } from "../articles"
import { createMapAssetFromFixture } from "../mapAssets"
import { createHeadingNode, createParagraph, createRichText } from "../richtext"

interface MapEntry {
  title: string
  svgAssetId: number
  dataAttribute: string
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
      dataAttribute: m.dataAttribute,
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
          dataAttribute: "data-margin",
        },
        {
          title: "120th Congress",
          svgAssetId: asset120.id,
          dataAttribute: "data-margin",
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
