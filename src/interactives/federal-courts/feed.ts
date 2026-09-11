import { courtTracker } from "@/integrations"
import type { FileSource } from "@/integrations/files"
import { RELEASE_REF, type ReleaseRef } from "@/integrations/github"
import type { FeedAdapter, FeedFetchOptions, FeedSnapshot } from "../types"
import { adaptCourtTracker } from "./adapter"
import type {
  Appointment,
  Court,
  CourtTrackerSources,
  Judge,
  Justice,
  Manifest,
  PresidentPhoto,
  SeatBlock,
} from "./upstream"

/** Upstream tags every manifest bump `data-v<manifest.version>` and cuts a release for it. */
export const COURT_TRACKER_TAG_PREFIX = "data-v"

/**
 * The release asset carrying exactly what we read: every runtime `data/*.json`, and none of
 * the photos, geometry or widget code that make up ~98% of the full package.
 */
export const COURT_TRACKER_JSON_ASSET = "data-json.tar.gz"

/**
 * The shape version we are written against, from upstream's data contract. It is semver over
 * the *shape*, separate from `version`'s content hash, so a MAJOR bump is the one thing that
 * can break this adapter without changing a single number we render.
 */
export const COURT_TRACKER_SCHEMA_MAJOR = 2

/** Reads upstream's manifest first, then exactly the files it lists. Geometry is never read. */
export async function readCourtTrackerSources(
  files: FileSource,
): Promise<FeedSnapshot<CourtTrackerSources>> {
  const manifest = await files.readJson<Manifest>("data/manifest.json")
  if (manifest.schema !== "court-tracker/manifest@1") {
    throw new Error(`${files.describe()}: unexpected manifest schema "${manifest.schema}"`)
  }
  // A MAJOR bump is a contract change — an enum gained a value, a field changed type, a file
  // went away — so it is refused here, where the message can say so. An older manifest
  // carries no schema version at all.
  const major = Number.parseInt(manifest.schema_version ?? "", 10)
  if (Number.isFinite(major) && major !== COURT_TRACKER_SCHEMA_MAJOR) {
    throw new Error(
      `${files.describe()}: data schema ${manifest.schema_version} is not the ${COURT_TRACKER_SCHEMA_MAJOR}.x this adapter reads — see the feed's SCHEMA_CHANGELOG before bumping COURT_TRACKER_SCHEMA_MAJOR`,
    )
  }
  const f = manifest.files
  const optional = async <T>(path: string | undefined): Promise<T | null> =>
    path ? files.readJson<T>(path) : null

  // `district_arrangement` and `judges_search` are listed and deliberately not read: the
  // first is a cartogram for upstream's own map, the second an index built for their widget's
  // vocabulary. We draw our own map and build our own index from the records we render.
  const [courts, seatBlocks, justices, presidents, appointments] = await Promise.all([
    files.readJson<Court[]>(f.courts),
    files.readJson<Record<string, SeatBlock>>(f.seat_blocks),
    files.readJson<Justice[]>(f.circuit_justices),
    optional<Record<string, PresidentPhoto>>(f.president_photos),
    optional<Appointment[]>(f.appointments),
  ])
  // Read together, keyed back in the manifest's own order: assigning as each read lands would
  // make the content hash depend on which request finished first, and two syncs of identical
  // data would each write a version saying nothing had changed.
  const bundles = Object.entries(f.judges)
  const loaded = await Promise.all(bundles.map(([, path]) => files.readJson<Judge[]>(path)))
  const judges: Record<string, Judge[]> = {}
  bundles.forEach(([bundle], i) => {
    judges[bundle] = loaded[i]!
  })
  return {
    version: manifest.version,
    generatedAt: manifest.generated,
    raw: { manifest, courts, seatBlocks, justices, judges, presidents, appointments },
  }
}

/**
 * The revision to read. Upstream asks consumers not to read `main` — a scheduled pull can
 * catch it mid-push — and cuts an immutable `data-v<version>` release per manifest bump. A
 * caller that pins something else is honoured; a repo with no release falls back to the branch.
 */
async function resolveRef(
  opts: FeedFetchOptions,
): Promise<{ ref: string; release: ReleaseRef | null }> {
  if (opts.ref !== RELEASE_REF && opts.ref !== "") return { ref: opts.ref, release: null }
  const release = await courtTracker.latestRelease({
    tagPrefix: COURT_TRACKER_TAG_PREFIX,
    fetchImpl: opts.fetchImpl,
  })
  return { ref: release?.tag ?? "main", release }
}

/**
 * Where one fetch reads its files from: the JSON archive when a release attaches one — one
 * request, and no way to see two files from two builds — or file by file at the ref.
 */
async function resolveSource(opts: FeedFetchOptions): Promise<{ ref: string; files: FileSource }> {
  const { ref, release } = await resolveRef(opts)
  const archive = release
    ? await courtTracker.filesFromRelease(release, COURT_TRACKER_JSON_ASSET, {
        fetchImpl: opts.fetchImpl,
      })
    : null
  return { ref, files: archive ?? courtTracker.filesAt(ref, { fetchImpl: opts.fetchImpl }) }
}

/**
 * The Federal Courts feed. The manifest is the contract: `version` says whether anything
 * moved, `files` say what to read.
 */
export const courtTrackerFeed: FeedAdapter<CourtTrackerSources> = {
  integration: courtTracker,
  describe: () => courtTracker.describe(),

  async peekVersion(opts) {
    if (opts.files) return (await opts.files.readJson<Manifest>("data/manifest.json")).version
    // A release tag carries the version, so the cheap poll is one request and never reads a
    // branch. Only a repo with no release yet has to open the manifest to answer this.
    const { ref, release } = await resolveRef(opts)
    if (release) return release.version
    const files = courtTracker.filesAt(ref, { fetchImpl: opts.fetchImpl })
    return (await files.readJson<Manifest>("data/manifest.json")).version
  },

  async fetch(opts) {
    if (opts.files) return readCourtTrackerSources(opts.files)
    const { ref, files } = await resolveSource(opts)
    const snapshot = await readCourtTrackerSources(files)
    return { ...snapshot, ref }
  },

  adapt: adaptCourtTracker,
}
