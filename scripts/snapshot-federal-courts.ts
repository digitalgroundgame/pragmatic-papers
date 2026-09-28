/**
 * Snapshots the Federal Courts interactive's inputs from court-tracker.
 *
 *   geometry   parse upstream's QGIS export (assets/geo/**) into the JSON the profile imports,
 *              and take the seat-block anchors measured against it
 *   data       run the real feed adapter and write the fixture the seed and tests use
 *
 * `geometry` needs a checkout on disk (the SVGs are not part of the feed — geometry is ours).
 * `data` reads a checkout with --source, or GitHub with COURT_TRACKER_GITHUB_TOKEN — by
 *   default upstream's newest published data release, or --ref to pin a branch, tag or sha
 * set, exactly as the sync job does; the fixture is therefore a real sync output.
 *
 * Usage:
 *   pnpm tsx scripts/snapshot-federal-courts.ts geometry --source ../court-tracker
 *   pnpm tsx scripts/snapshot-federal-courts.ts data --source ../court-tracker --ref data-v05d95d9fcf1b
 *   pnpm tsx scripts/snapshot-federal-courts.ts data --ref data-v05d95d9fcf1b
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { validateDrilldownData } from "../src/interactives/contract"
import { courtTrackerFeed } from "../src/interactives/federal-courts/feed"
import { loadFederalCourtsGeometry } from "../src/interactives/federal-courts/geometry"
import { svgToGeometryFile } from "../src/interactives/geometry"
import { hashDrilldownData } from "../src/interactives/hash"
import { localFileSource } from "../src/integrations/files"
import { RELEASE_REF } from "../src/integrations/github"

const PROFILE_DIR = path.resolve("src/interactives/federal-courts")
export const CIRCUITS = [
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
]

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function kb(s: string): string {
  return `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`
}

/**
 * Where each court's seat block is drawn, taken once from upstream's `seat_blocks.json` and
 * checked in beside the geometry it is measured against.
 *
 * Upstream tiers `anchor` as renderer-specific — hand-placed for their own map, free to move
 * without notice — and placement is ours to own anyway. Reading it from the feed daily meant
 * a nudge to their layout silently moved ours; taken here, it moves when the geometry it
 * belongs to moves, in a diff someone reviews.
 */
function snapshotAnchors(source: string, outDir: string): void {
  const blocks = JSON.parse(
    readFileSync(path.join(source, "data", "seat_blocks.json"), "utf8"),
  ) as Record<string, { anchor: [number, number] | null }>
  const anchors: Record<string, [number, number]> = {}
  for (const id of Object.keys(blocks).sort()) {
    const anchor = blocks[id]?.anchor
    if (anchor) anchors[id] = anchor
  }
  const json = JSON.stringify(anchors)
  writeFileSync(path.join(outDir, "anchors.json"), json)
  console.warn(
    `anchors.json${" ".repeat(11)}${kb(json).padStart(8)} · ${Object.keys(anchors).length} blocks`,
  )
}

export function snapshotGeometry(source: string, profileDir = PROFILE_DIR): number {
  const geoDir = path.join(source, "assets", "geo")
  const outDir = path.join(profileDir, "geometry")
  mkdirSync(path.join(outDir, "circuits"), { recursive: true })
  const write = (rel: string, svg: string): void => {
    const file = svgToGeometryFile(svg)
    const json = JSON.stringify(file)
    writeFileSync(path.join(outDir, rel), json)
    const ids = file.paths.filter((p) => p.id).length
    console.warn(`${rel.padEnd(22)} ${kb(json).padStart(8)} · ${ids} regions`)
  }
  write("national.json", readFileSync(path.join(geoDir, "national.svg"), "utf8"))
  for (const id of CIRCUITS)
    write(`circuits/${id}.json`, readFileSync(path.join(geoDir, "circuits", `${id}.svg`), "utf8"))
  snapshotAnchors(source, outDir)
  return 0
}

export async function snapshotData(
  argv: readonly string[],
  env: Record<string, string | undefined> = process.env,
  profileDir = PROFILE_DIR,
): Promise<number> {
  const source = arg(argv, "--source")
  const ref = arg(argv, "--ref") ?? RELEASE_REF
  // What the fixture records as its provenance. Reading a checkout, that is the directory —
  // unless the caller says which release the checkout is of, which is the useful answer and
  // the only one that means anything in another clone.
  const recordedRef = source ? (arg(argv, "--ref") ?? `dir:${path.resolve(source)}`) : ref
  const opts = source
    ? { ref: recordedRef, files: localFileSource(path.resolve(source)) }
    : { ref, token: env.COURT_TRACKER_GITHUB_TOKEN ?? null }
  if (!source && !opts.token) {
    console.error("set COURT_TRACKER_GITHUB_TOKEN or pass --source <checkout>")
    return 1
  }
  console.warn(`reading ${source ? `dir:${source}` : `${courtTrackerFeed.describe()}@${ref}`}`)
  const snapshot = await courtTrackerFeed.fetch(opts)
  const data = courtTrackerFeed.adapt(snapshot, { ref: snapshot.ref ?? recordedRef })
  const geometry = await loadFederalCourtsGeometry()
  const { errors } = validateDrilldownData(data, geometry)
  if (errors.length > 0) {
    console.error("feed is invalid:\n  " + errors.join("\n  "))
    return 1
  }
  const outDir = path.join(profileDir, "fixtures")
  mkdirSync(outDir, { recursive: true })
  const json = JSON.stringify(data)
  writeFileSync(path.join(outDir, "data.json"), json)
  console.warn(
    `fixtures/data.json ${kb(json)} · upstream ${snapshot.version} · content ${hashDrilldownData(data)} · ${data.regions.length} regions · ${data.records.length} records · datasets: ${Object.keys(data.datasets ?? {}).join(", ") || "none"}`,
  )
  return 0
}

/** The command line, as an exit code: 0 done, 1 refused or invalid, 2 not a command. */
export function run(
  argv: readonly string[],
  env: Record<string, string | undefined> = process.env,
  profileDir = PROFILE_DIR,
): Promise<number> {
  const command = argv[0]
  if (command === "geometry")
    return Promise.resolve(
      snapshotGeometry(path.resolve(arg(argv, "--source") ?? "../court-tracker"), profileDir),
    )
  if (command === "data") return snapshotData(argv, env, profileDir)
  console.error(
    "usage: snapshot-federal-courts.ts <geometry|data> [--source dir] [--ref ref|release]",
  )
  return Promise.resolve(2)
}

if (!process.env.VITEST) void run(process.argv.slice(2)).then((code) => process.exit(code))
