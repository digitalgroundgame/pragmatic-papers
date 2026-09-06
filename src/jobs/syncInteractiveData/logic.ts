import type { Payload } from "payload"

import { validateDrilldownData } from "@/interactives/contract"
import { hashDrilldownData } from "@/interactives/hash"
import { RELEASE_REF } from "@/interactives/sources/releases"
import { getProfile } from "@/interactives/profiles"
import type { FileSource } from "@/interactives/sources/files"
import type { DrilldownData, InteractiveProfile } from "@/interactives/types"
import type { Interactive, InteractiveSnapshot } from "@/payload-types"

export interface Logger {
  debug(msg: string): void
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
}

export type SyncOutcome =
  | { outcome: "synced"; status: "draft" | "published"; sourceVersion: string; contentHash: string }
  | { outcome: "unchanged"; reason: "source-version" | "content" }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; errors: string[] }

export interface SyncOptions {
  log: Logger
  /** Re-read even when upstream's version stamp has not moved. */
  force?: boolean
  fetchImpl?: typeof fetch
  /** Read the feed from here instead of its upstream (tests, offline). */
  files?: FileSource
  now?: () => Date
}

const prefix = (i: Pick<Interactive, "slug" | "title">): string =>
  `[interactive-sync:${i.slug ?? i.title}]`

/** The one snapshot document for an interactive, with its newest version — draft or published. */
export async function findLatestSnapshot(
  payload: Payload,
  interactiveId: number,
): Promise<InteractiveSnapshot | null> {
  const { docs } = await payload.find({
    collection: "interactive-snapshots",
    where: { interactive: { equals: interactiveId } },
    draft: true,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

export function describeData(data: DrilldownData): string {
  const datasets = Object.keys(data.datasets ?? {})
  return `${data.regions.length.toLocaleString("en-US")} regions · ${data.records.length.toLocaleString("en-US")} records${datasets.length ? ` · datasets: ${datasets.join(", ")}` : ""}`
}

function labelFor(interactive: Pick<Interactive, "title">, data: DrilldownData): string {
  const day = data.generatedAt.slice(0, 10)
  return `${interactive.title} — ${day} (${data.source.version.slice(0, 7)})`
}

export interface SnapshotFields {
  label: string
  interactive: number
  summary: string
  sourceVersion: string
  sourceRef: string
  contentHash: string
  generatedAt: string
  syncedAt: string
  data: InteractiveSnapshot["data"]
  _status: "draft" | "published"
}

/** Everything a snapshot version records about one validated feed. Shared with the seed. */
export function buildSnapshotFields(
  interactive: Pick<Interactive, "id" | "title">,
  data: DrilldownData,
  { ref, syncedAt, status }: { ref: string; syncedAt: string; status: "draft" | "published" },
): SnapshotFields {
  return {
    label: labelFor(interactive, data),
    interactive: interactive.id,
    summary: describeData(data),
    sourceVersion: data.source.version,
    sourceRef: ref,
    contentHash: hashDrilldownData(data),
    generatedAt: data.generatedAt,
    syncedAt,
    data: data as unknown as InteractiveSnapshot["data"],
    _status: status,
  }
}

/**
 * One interactive, one run. Reads upstream only when its version stamp moved (or on
 * `force`), validates what came back against the profile's geometry, and writes a new
 * snapshot version only when the rendered content actually changed. Every early exit is an
 * outcome, not an exception: the schedule keeps going to the next interactive, and the
 * "run now" endpoint reports what happened.
 */
export async function syncInteractive(
  payload: Payload,
  interactive: Interactive,
  { log, force = false, fetchImpl, files, now = () => new Date() }: SyncOptions,
): Promise<SyncOutcome> {
  const tag = prefix(interactive)
  const profile: InteractiveProfile | null = getProfile(interactive.profile)
  if (!profile) {
    log.warn(`${tag} unknown profile "${interactive.profile}" — skipping`)
    return { outcome: "skipped", reason: `unknown profile "${interactive.profile}"` }
  }
  if (interactive.feed?.enabled === false) {
    log.debug(`${tag} feed disabled — skipping`)
    return { outcome: "skipped", reason: "feed disabled" }
  }
  const tokenEnv = profile.feed.tokenEnv
  const token = tokenEnv ? (process.env[tokenEnv]?.trim() ?? null) : null
  if (tokenEnv && !token && !files) {
    log.warn(`${tag} ${tokenEnv} is not set — skipping ${profile.feed.describe()}`)
    return { outcome: "skipped", reason: `${tokenEnv} not set` }
  }
  // Empty means "whatever upstream last released": the adapter resolves an immutable tag, so
  // a scheduled pull never races a branch mid-push. A pinned value is honoured verbatim.
  const requestedRef = interactive.feed?.ref?.trim() || RELEASE_REF
  const fetchOpts = { ref: requestedRef, token, fetchImpl, files }

  const latest = await findLatestSnapshot(payload, interactive.id)

  if (!force && latest) {
    const version = await profile.feed.peekVersion(fetchOpts)
    if (version === latest.sourceVersion) {
      log.debug(`${tag} upstream still at ${version} — nothing to read`)
      return { outcome: "unchanged", reason: "source-version" }
    }
    log.info(`${tag} upstream moved ${latest.sourceVersion} → ${version}`)
  }

  log.debug(`${tag} reading ${profile.feed.describe()}@${requestedRef}`)
  const snapshot = await profile.feed.fetch(fetchOpts)
  // What the adapter actually read. Recording the resolved tag rather than "release" is what
  // makes a snapshot's provenance reproducible.
  const ref = snapshot.ref ?? requestedRef
  const adapted = profile.feed.adapt(snapshot, { ref })
  const geometry = await profile.loadGeometry()
  const { data, errors } = validateDrilldownData(adapted, geometry)
  if (!data) {
    log.error(
      `${tag} feed ${snapshot.version} is invalid — keeping the last good snapshot:\n  ${errors.join("\n  ")}`,
    )
    return { outcome: "failed", errors }
  }

  const contentHash = hashDrilldownData(data)
  const syncedAt = now().toISOString()

  if (latest && latest.contentHash === contentHash) {
    // Upstream rebuilt without changing what we render. Advance the stamps so the next run
    // can short-circuit on the version, but write no new version.
    await payload.update({
      collection: "interactive-snapshots",
      id: latest.id,
      data: { sourceVersion: snapshot.version, sourceRef: ref, syncedAt },
      draft: latest._status !== "published",
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    log.info(
      `${tag} upstream ${snapshot.version} renders identically to ${latest.contentHash} — stamped, no new version`,
    )
    return { outcome: "unchanged", reason: "content" }
  }

  const autoPublish = interactive.feed?.autoPublish === true
  const status = autoPublish ? "published" : "draft"
  const fields = buildSnapshotFields(interactive, data, { ref, syncedAt, status })

  if (latest) {
    await payload.update({
      collection: "interactive-snapshots",
      id: latest.id,
      data: fields,
      draft: !autoPublish,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  } else {
    await payload.create({
      collection: "interactive-snapshots",
      data: fields,
      draft: !autoPublish,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }
  log.info(
    `${tag} wrote ${status} snapshot ${contentHash} from upstream ${snapshot.version} — ${describeData(data)}`,
  )
  return { outcome: "synced", status, sourceVersion: snapshot.version, contentHash }
}
