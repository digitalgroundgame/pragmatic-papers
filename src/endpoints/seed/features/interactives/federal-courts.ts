import type { Payload } from "payload"

import { validateDrilldownData } from "@/interactives/contract"
import { courtTrackerFeed } from "@/interactives/federal-courts/feed"
import fixture from "@/interactives/federal-courts/fixtures/data.json"
import { courtTracker, describeStatus, integrationStatus } from "@/integrations"
import { RELEASE_REF } from "@/integrations/github"
import { FEDERAL_COURTS_PROFILE_ID } from "@/interactives/federal-courts"
import { loadFederalCourtsGeometry } from "@/interactives/federal-courts/geometry"
import { buildSnapshotFields } from "@/jobs/syncInteractiveData/logic"
import type { Interactive } from "@/payload-types"

import { createParagraph, createRichText } from "../../richtext"

export const FEDERAL_COURTS_INTERACTIVE_SLUG = "federal-courts"

const FJC_URL = "https://www.fjc.gov/history/judges"

/**
 * Upstream's newest release through the real feed adapter, or null — with the reason logged —
 * when there is no token to read it with or the read fails. The seed then falls back to the
 * fixture, which is a trimmed copy of the same adapter output.
 */
async function readLiveFeed(payload: Payload): Promise<unknown> {
  const connection = integrationStatus(courtTracker)
  if (!connection.configured) {
    payload.logger.info(
      `[seed] federal courts: ${describeStatus(connection)} — using the trimmed fixture`,
    )
    return null
  }
  try {
    const snapshot = await courtTrackerFeed.fetch({ ref: RELEASE_REF })
    return courtTrackerFeed.adapt(snapshot, { ref: snapshot.ref ?? RELEASE_REF })
  } catch (err) {
    payload.logger.warn(
      `[seed] federal courts: could not read court-tracker (${err instanceof Error ? err.message : String(err)}) — using the trimmed fixture`,
    )
    return null
  }
}

/**
 * Seeds the Federal Courts interactive page: the editorial document, and a published snapshot
 * written the way the sync writes one, so what the seeded page renders is exactly what a synced
 * page renders.
 *
 * The data is `fixtures/data.json` unless `live` is set: then it is upstream's newest release,
 * read with `COURT_TRACKER_GITHUB_TOKEN`, falling back to the fixture without one. The fixture
 * is a real adapter output trimmed to three courts' benches (`scripts/snapshot-federal-courts.ts
 * data --keep`), so tests and CI stay small and deterministic; `pnpm dev:db-seed` with a token
 * gets every judge.
 */
export const createFederalCourtsInteractive = async (
  payload: Payload,
  ctx?: Record<string, unknown>,
  publishedAt?: string,
  { live = false }: { live?: boolean } = {},
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

  const geometry = await loadFederalCourtsGeometry()
  const liveFeed = live ? await readLiveFeed(payload) : null
  let checked = liveFeed ? validateDrilldownData(liveFeed, geometry) : null
  if (checked && !checked.data) {
    payload.logger.warn(
      `[seed] federal courts: court-tracker's release is invalid — using the trimmed fixture:\n  ${checked.errors.join("\n  ")}`,
    )
    checked = null
  }
  const { data, errors } = checked ?? validateDrilldownData(fixture, geometry)
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
