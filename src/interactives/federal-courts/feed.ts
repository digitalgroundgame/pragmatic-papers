import { githubFileSource, type FileSource } from "../sources/files"
import type { FeedAdapter, FeedFetchOptions, FeedSnapshot } from "../types"
import { adaptCourtTracker } from "./adapter"
import type {
  Appointment,
  Court,
  CourtTrackerSources,
  DistrictArrangement,
  Judge,
  Justice,
  Manifest,
  PresidentPhoto,
  SeatBlock,
} from "./upstream"

export const COURT_TRACKER_REPO_ENV = "COURT_TRACKER_REPO"
export const COURT_TRACKER_TOKEN_ENV = "COURT_TRACKER_GITHUB_TOKEN"
export const DEFAULT_COURT_TRACKER_REPO = "digitalgroundgame/court-tracker"

export function courtTrackerRepo(): string {
  return process.env[COURT_TRACKER_REPO_ENV]?.trim() || DEFAULT_COURT_TRACKER_REPO
}

/** Reads upstream's manifest first, then exactly the files it lists. Geometry is never read. */
export async function readCourtTrackerSources(
  files: FileSource,
): Promise<FeedSnapshot<CourtTrackerSources>> {
  const manifest = await files.readJson<Manifest>("data/manifest.json")
  if (manifest.schema !== "court-tracker/manifest@1") {
    throw new Error(`${files.describe()}: unexpected manifest schema "${manifest.schema}"`)
  }
  const f = manifest.files
  const optional = async <T>(path: string | undefined): Promise<T | null> =>
    path ? files.readJson<T>(path) : null

  const [courts, seatBlocks, justices, presidents, arrangement, appointments] = await Promise.all([
    files.readJson<Court[]>(f.courts),
    files.readJson<Record<string, SeatBlock>>(f.seat_blocks),
    files.readJson<Justice[]>(f.circuit_justices),
    optional<Record<string, PresidentPhoto>>(f.president_photos),
    optional<DistrictArrangement>(f.district_arrangement),
    optional<Appointment[]>(f.appointments),
  ])
  const judges: Record<string, Judge[]> = {}
  await Promise.all(
    Object.entries(f.judges).map(async ([bundle, path]) => {
      judges[bundle] = await files.readJson<Judge[]>(path)
    }),
  )
  return {
    version: manifest.version,
    generatedAt: manifest.generated,
    raw: { manifest, courts, seatBlocks, justices, judges, presidents, arrangement, appointments },
  }
}

function sourceFor(opts: FeedFetchOptions): FileSource {
  return (
    opts.files ??
    githubFileSource({
      repo: courtTrackerRepo(),
      ref: opts.ref,
      token: opts.token,
      fetchImpl: opts.fetchImpl,
    })
  )
}

/**
 * The Federal Courts feed. The researcher's manifest is the contract: its `version` says
 * whether anything moved, its `files` say what to read. Nothing here asks the researcher to
 * change what they publish.
 */
export const courtTrackerFeed: FeedAdapter<CourtTrackerSources> = {
  tokenEnv: COURT_TRACKER_TOKEN_ENV,
  describe: () => `github:${courtTrackerRepo()}`,
  async peekVersion(opts) {
    const manifest = await sourceFor(opts).readJson<Manifest>("data/manifest.json")
    return manifest.version
  },
  fetch: (opts) => readCourtTrackerSources(sourceFor(opts)),
  adapt: adaptCourtTracker,
}
