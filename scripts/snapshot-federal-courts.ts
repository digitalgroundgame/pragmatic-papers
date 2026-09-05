/**
 * Snapshots the Federal Courts interactive's inputs from court-tracker.
 *
 *   geometry   parse upstream's QGIS export (assets/geo/**) into the JSON the profile imports
 *   data       run the real feed adapter and write the fixture the seed and tests use
 *
 * `geometry` needs a checkout on disk (the SVGs are not part of the feed — geometry is ours).
 * `data` reads a checkout with --source, or GitHub at --ref with COURT_TRACKER_GITHUB_TOKEN
 * set, exactly as the sync job does; the fixture is therefore a real sync output.
 *
 * Usage:
 *   pnpm tsx scripts/snapshot-federal-courts.ts geometry --source ../court-tracker
 *   pnpm tsx scripts/snapshot-federal-courts.ts data --source ../court-tracker
 *   pnpm tsx scripts/snapshot-federal-courts.ts data --ref main
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { validateDrilldownData } from "../src/interactives/contract"
import { courtTrackerFeed } from "../src/interactives/federal-courts/feed"
import { loadFederalCourtsGeometry } from "../src/interactives/federal-courts/geometry"
import { svgToGeometryFile } from "../src/interactives/geometry"
import { hashDrilldownData } from "../src/interactives/hash"
import { localFileSource } from "../src/interactives/sources/files"

const PROFILE_DIR = path.resolve("src/interactives/federal-courts")
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
]

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function kb(s: string): string {
  return `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`
}

function snapshotGeometry(source: string): number {
  const geoDir = path.join(source, "assets", "geo")
  const outDir = path.join(PROFILE_DIR, "geometry")
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
  return 0
}

async function snapshotData(): Promise<number> {
  const source = arg("--source")
  const ref = arg("--ref") ?? "main"
  const opts = source
    ? { ref: `dir:${path.resolve(source)}`, files: localFileSource(path.resolve(source)) }
    : { ref, token: process.env.COURT_TRACKER_GITHUB_TOKEN ?? null }
  if (!source && !opts.token) {
    console.error("set COURT_TRACKER_GITHUB_TOKEN or pass --source <checkout>")
    return 1
  }
  console.warn(`reading ${source ? `dir:${source}` : `${courtTrackerFeed.describe()}@${ref}`}`)
  const snapshot = await courtTrackerFeed.fetch(opts)
  const data = courtTrackerFeed.adapt(snapshot, { ref: opts.ref })
  const geometry = await loadFederalCourtsGeometry()
  const { errors } = validateDrilldownData(data, geometry)
  if (errors.length > 0) {
    console.error("feed is invalid:\n  " + errors.join("\n  "))
    return 1
  }
  const outDir = path.join(PROFILE_DIR, "fixtures")
  mkdirSync(outDir, { recursive: true })
  const json = JSON.stringify(data)
  writeFileSync(path.join(outDir, "data.json"), json)
  console.warn(
    `fixtures/data.json ${kb(json)} · upstream ${snapshot.version} · content ${hashDrilldownData(data)} · ${data.regions.length} regions · ${data.records.length} records · datasets: ${Object.keys(data.datasets ?? {}).join(", ") || "none"}`,
  )
  return 0
}

const command = process.argv[2]
const run =
  command === "geometry"
    ? Promise.resolve(snapshotGeometry(path.resolve(arg("--source") ?? "../court-tracker")))
    : command === "data"
      ? snapshotData()
      : Promise.resolve(
          (console.error(
            "usage: snapshot-federal-courts.ts <geometry|data> [--source dir] [--ref ref]",
          ),
          2),
        )
run.then((code) => process.exit(code))
