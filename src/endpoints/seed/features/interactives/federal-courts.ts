import type { Payload } from "payload"

import { validateDrilldownData } from "@/interactives/contract"
import fixture from "@/interactives/federal-courts/fixtures/data.json"
import { RELEASE_REF } from "@/interactives/sources/releases"
import { FEDERAL_COURTS_PROFILE_ID } from "@/interactives/federal-courts"
import { loadFederalCourtsGeometry } from "@/interactives/federal-courts/geometry"
import { buildSnapshotFields } from "@/jobs/syncInteractiveData/logic"
import type { Interactive } from "@/payload-types"

import { createParagraph, createRichText } from "../../richtext"

export const FEDERAL_COURTS_INTERACTIVE_SLUG = "federal-courts"

const FJC_URL = "https://www.fjc.gov/history/judges"

/**
 * Seeds the Federal Courts interactive page: the editorial document, and a published snapshot
 * built from `fixtures/data.json` — a real output of the feed adapter, regenerated with
 * `scripts/snapshot-federal-courts.ts data`. The seed writes the snapshot the way the sync
 * does, so what the seeded page renders is exactly what a synced page renders.
 */
export const createFederalCourtsInteractive = async (
  payload: Payload,
  ctx?: Record<string, unknown>,
  publishedAt?: string,
): Promise<number> => {
  const title = "Federal Court Appointment Tracker"

  const interactive: Interactive = await payload.create({
    collection: "interactives",
    context: ctx,
    overrideAccess: true,
    data: {
      title,
      slug: FEDERAL_COURTS_INTERACTIVE_SLUG,
      profile: FEDERAL_COURTS_PROFILE_ID,
      intro: createRichText([
        createParagraph(
          "Who sits on every federal bench, and who put them there. Pick a circuit to see its judges ringed by the party of the appointing president, switch to Seats for the authorized bench with its majority line, and open the circuit's districts to go one level down. Data is synced from the court-tracker project and reviewed before it goes live.",
        ),
      ]),
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
      feed: { enabled: true, ref: RELEASE_REF, autoPublish: false },
      publishedAt,
      _status: "published",
      meta: {
        title,
        description:
          "Every federal circuit and district court and the judges who sit on them, with the party of each appointing president — synced from the court-tracker project.",
      },
    },
  })

  const { data, errors } = validateDrilldownData(fixture, await loadFederalCourtsGeometry())
  if (!data) throw new Error(`federal-courts fixture is invalid:\n  ${errors.join("\n  ")}`)

  await payload.create({
    collection: "interactive-snapshots",
    context: ctx,
    overrideAccess: true,
    data: buildSnapshotFields(interactive, data, {
      ref: data.source.ref ?? "fixture",
      syncedAt: new Date().toISOString(),
      status: "published",
    }),
  })

  return interactive.id
}
