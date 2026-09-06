import { githubFileSource, type FileSource } from "../sources/files"
import { latestTaggedRelease, RELEASE_REF, type ReleaseRef } from "../sources/releases"
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

/** Upstream tags every manifest bump `data-v<manifest.version>` and cuts a release for it. */
export const COURT_TRACKER_TAG_PREFIX = "data-v"

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

/**
 * The revision to read. Upstream asks consumers not to read `main`, because a scheduled pull
 * can catch it mid-push or catch `data/` and `assets/geo/` disagreeing across two commits;
 * every manifest bump cuts an immutable `data-v<version>` release instead. A caller that pins
 * something else is honoured, and a repo that has published no release yet falls back to the
 * default branch so this keeps working before upstream's release workflow lands.
 */
async function resolveRef(
  opts: FeedFetchOptions,
): Promise<{ ref: string; release: ReleaseRef | null }> {
  if (opts.ref !== RELEASE_REF && opts.ref !== "") return { ref: opts.ref, release: null }
  const release = await latestTaggedRelease({
    repo: courtTrackerRepo(),
    tagPrefix: COURT_TRACKER_TAG_PREFIX,
    token: opts.token,
    fetchImpl: opts.fetchImpl,
  })
  return { ref: release?.tag ?? "main", release }
}

function sourceAt(ref: string, opts: FeedFetchOptions): FileSource {
  return githubFileSource({
    repo: courtTrackerRepo(),
    ref,
    token: opts.token,
    fetchImpl: opts.fetchImpl,
  })
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
    if (opts.files) return (await opts.files.readJson<Manifest>("data/manifest.json")).version
    // A release tag carries the version, so the cheap poll is one request and never reads a
    // branch. Only a repo with no release yet has to open the manifest to answer this.
    const { ref, release } = await resolveRef(opts)
    if (release) return release.version
    return (await sourceAt(ref, opts).readJson<Manifest>("data/manifest.json")).version
  },

  async fetch(opts) {
    if (opts.files) return readCourtTrackerSources(opts.files)
    const { ref } = await resolveRef(opts)
    const snapshot = await readCourtTrackerSources(sourceAt(ref, opts))
    return { ...snapshot, ref }
  },

  adapt: adaptCourtTracker,
}
