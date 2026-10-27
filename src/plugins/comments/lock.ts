import type { CollectionSlug, Payload } from "payload"

import { VIOLATIONS_SLUG } from "./constants"
import type { CommentSettings, ViolationSource } from "./types"

export interface Violation {
  source: ViolationSource
  createdAt: string
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Whether an author's violations stop them commenting, and until when. A moderator's block
 * holds until it's reversed (`until: null`). Otherwise the account locks while it has
 * `violationThreshold` violations from the last `violationWindowDays`, and unlocks when
 * enough of them have aged out.
 *
 * `violations` are the author's unreversed ones; reversed ones never count.
 */
export function lockFor(
  violations: Violation[],
  settings: Pick<CommentSettings, "violationThreshold" | "violationWindowDays">,
  now = Date.now(),
): { until: string | null } | null {
  if (violations.some(({ source }) => source === "block")) return { until: null }

  const window = settings.violationWindowDays * DAY
  const active = violations
    .map(({ createdAt }) => new Date(createdAt).getTime())
    .filter((time) => time > now - window)
    .sort((a, b) => a - b)
  if (active.length < settings.violationThreshold) return null

  // Unlocks once only threshold - 1 remain: when this one ages out.
  const deciding = active[active.length - settings.violationThreshold]!
  return { until: new Date(deciding + window).toISOString() }
}

/** `lockFor` an author, reading their violations. */
export async function authorLock(
  payload: Payload,
  authorId: number | string,
  settings: CommentSettings,
): Promise<{ until: string | null } | null> {
  const since = new Date(Date.now() - settings.violationWindowDays * DAY).toISOString()
  const { docs } = await payload.find({
    collection: VIOLATIONS_SLUG as CollectionSlug,
    where: {
      author: { equals: authorId },
      reversed: { not_equals: true },
      or: [{ source: { equals: "block" } }, { createdAt: { greater_than: since } }],
    },
    select: { source: true, createdAt: true },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return lockFor(docs as unknown as Violation[], settings)
}
