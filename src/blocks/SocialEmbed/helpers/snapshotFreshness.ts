import type { SocialEmbedSnapshot } from "@/payload-types"

/**
 * How long we trust a snapshot as "fresh" for allowing provider enhancement scripts.
 *
 * The goal: once a post is deleted/private later, we eventually stop enhancing and
 * fall back to the saved static markup (blockquote/link/etc).
 */
export const SOCIAL_EMBED_SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

function getSnapshotFetchedAtMs(snapshot: SocialEmbedSnapshot | null | undefined): number | null {
  const raw = snapshot?.fetchedAt
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

export function shouldEnhance(snapshot: SocialEmbedSnapshot | null | undefined): boolean {
  return snapshot?.status === "ok"
}

function isSnapshotExpired(
  snapshot: SocialEmbedSnapshot | null | undefined,
  ttlMs: number = SOCIAL_EMBED_SNAPSHOT_TTL_MS,
): boolean {
  const fetchedAtMs = getSnapshotFetchedAtMs(snapshot)
  if (fetchedAtMs == null) return true
  return Date.now() - fetchedAtMs > ttlMs
}

export function shouldRevalidate(
  snapshot: SocialEmbedSnapshot | null | undefined,
  ttlMs: number = SOCIAL_EMBED_SNAPSHOT_TTL_MS,
): boolean {
  return snapshot?.status === "ok" && isSnapshotExpired(snapshot, ttlMs)
}

/**
 * The later of two snapshots of one embed, by `fetchedAt`: the copy saved in the article and
 * the refreshed one in `embed-snapshots`. A snapshot with no date loses to one with a date.
 */
export function newestSnapshot(
  a: SocialEmbedSnapshot | null | undefined,
  b: SocialEmbedSnapshot | null | undefined,
): SocialEmbedSnapshot | undefined {
  if (!a) return b ?? undefined
  if (!b) return a
  return (getSnapshotFetchedAtMs(b) ?? -Infinity) > (getSnapshotFetchedAtMs(a) ?? -Infinity) ? b : a
}
