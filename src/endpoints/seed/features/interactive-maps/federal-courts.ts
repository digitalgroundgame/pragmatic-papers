import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createArticle, validateWriters } from "../../articles"
import { createMapAssetFromFixture } from "../../mapAssets"
import { createHeadingNode, createParagraph, createRichText } from "../../richtext"

export const FEDERAL_COURTS_SLUG = "federal-court-appointment-tracker"

/** Circuits in selector order; each has a child asset (cafc carries records only, no geometry). */
const CIRCUITS = [
  "ca1",
  "ca2",
  "ca3",
  "ca4",
  "ca5",
  "ca6",
  "ca7",
  "ca8",
  "ca9",
  "ca10",
  "ca11",
  "cadc",
  "cafc",
] as const

const FJC_URL = "https://www.fjc.gov/history/judges"

const createDrilldownMapNode = (
  overviewAssetId: number,
  regionAssets: { regionId: string; svgAssetId: number }[],
) => ({
  type: "block",
  fields: {
    blockType: "interactiveMap",
    mode: "drilldown",
    widgetTitle: "Federal Court Appointment Tracker",
    drilldown: {
      overviewAsset: overviewAssetId,
      regionAssets: regionAssets.map((r) => ({ regionId: r.regionId, svgAsset: r.svgAssetId })),
    },
    sources: [
      {
        link: {
          type: "custom",
          label: "Federal Judicial Center, Biographical Directory of Article III Federal Judges",
          url: FJC_URL,
          newTab: true,
          variant: "link",
        },
      },
      {
        link: {
          type: "custom",
          label: "U.S. Census Bureau (county boundaries)",
          url: "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html",
          newTab: true,
          variant: "link",
        },
      },
    ],
  },
  format: "",
  version: 2,
})

/**
 * Seeds the first drilldown-mode article: the national circuit/district map that drills into
 * each circuit's districts with the sitting judges as records. The assets are baked from the
 * court-tracker repository by scripts/bake-court-tracker-fixtures.ts; nothing court-specific
 * lives in the block, only in these uploaded files.
 */
export const createFederalCourtsArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
  ctx?: Record<string, unknown>,
  publishedAt?: string,
): Promise<number> => {
  validateWriters(writers)
  const writer = writers[0]!
  const title = "Who Sits on the Federal Bench: An Appointment Tracker for Every Circuit"

  const overview = await createMapAssetFromFixture(
    payload,
    "federal-courts/national.svg",
    "Federal courts — national overview (circuits and districts)",
    FJC_URL,
  )
  const regionAssets: { regionId: string; svgAssetId: number }[] = []
  for (const id of CIRCUITS) {
    const asset = await createMapAssetFromFixture(
      payload,
      `federal-courts/circuits/${id}.svg`,
      `Federal courts — ${id} districts and bench`,
      FJC_URL,
    )
    regionAssets.push({ regionId: id, svgAssetId: asset.id })
  }

  const article = await createArticle(
    payload,
    {
      title,
      content: createRichText([
        createParagraph(
          "The Interactive Map block's drilldown mode shows one overview map you drill into: pick a circuit to see who sits on its bench, then open its districts. The child geometry and the judge records are not loaded until you drill in.",
        ),
        createHeadingNode("The federal judiciary, circuit by circuit", "h2"),
        createParagraph(
          "Hover a circuit for its authorized judgeships, active and senior judges and vacancies. Click it to open the bench: each judge is ringed by the party of the appointing president, ordered by commission date, with senior judges greyed. Switch to Seats for the authorized bench as a semicircle with the majority line, and use View districts to morph into the circuit's own map.",
        ),
        createDrilldownMapNode(overview.id, regionAssets),
        createHeadingNode("About the data", "h2"),
        createParagraph(
          "Judge records come from the Federal Judicial Center's Biographical Directory, assembled and verified in the court-tracker project. Reported affiliations are shown only where a source is cited, and every photo carries its Wikimedia Commons license.",
        ),
      ]),
      authors: [writer.id],
      topics,
      slug: FEDERAL_COURTS_SLUG,
      heroImage: mediaDocs[1]?.id ?? mediaDocs[0]?.id,
      publishedAt,
      meta: {
        title,
        description:
          "A seeded article demonstrating the Interactive Map block's drilldown mode with the federal circuit and district courts and their sitting judges.",
        image: mediaDocs[1]?.id ?? mediaDocs[0]?.id,
      },
    },
    ctx,
  )

  return article.id
}
