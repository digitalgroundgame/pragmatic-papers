import type { CollectionSlug, Payload, PayloadRequest } from "payload"

import { relationshipId } from "@/utilities/relationships"

import { READS_SLUG, VISITS_FIELD } from "./constants"
import { streakAt, visitsOf } from "./days"
import type { MyReading, ReadingUser, ResolvedReadingHistoryConfig } from "./types"

/** The articles `user` has read, by ID. */
export async function articlesReadBy(
  payload: Payload,
  user: ReadingUser,
  req?: Partial<PayloadRequest>,
): Promise<Set<string>> {
  const { docs } = await payload.find({
    collection: READS_SLUG as CollectionSlug,
    where: { user: { equals: user.id } },
    select: { article: true } as never,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const ids = docs
    .map((doc) => relationshipId((doc as { article?: unknown }).article as never))
    .filter((id): id is number => id !== null)
  return new Set(ids.map(String))
}

/** How many published groups (volumes) have articles, every one of them in `read`. */
export async function groupsFinished(
  payload: Payload,
  read: Set<string>,
  config: ResolvedReadingHistoryConfig,
  req?: Partial<PayloadRequest>,
): Promise<number | null> {
  if (!config.groups) return null
  if (read.size === 0) return 0
  const { slug, field } = config.groups
  const { docs } = await payload.find({
    collection: slug,
    where: { _status: { equals: "published" } },
    select: { [field]: true } as never,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return docs.filter((doc) => {
    const members = (doc as Record<string, unknown>)[field]
    if (!Array.isArray(members) || members.length === 0) return false
    return members.every((member) => {
      const id = relationshipId(member as never)
      return id !== null && id !== undefined && read.has(String(id))
    })
  }).length
}

/** A reader's totals, for their account page. */
export async function readingTotals(
  payload: Payload,
  user: ReadingUser,
  config: ResolvedReadingHistoryConfig,
  now: number,
  req?: Partial<PayloadRequest>,
): Promise<MyReading> {
  const read = await articlesReadBy(payload, user, req)
  const visits = visitsOf(user, VISITS_FIELD)
  return {
    articlesRead: read.size,
    volumesRead: await groupsFinished(payload, read, config, req),
    daysVisited: visits.daysVisited,
    currentStreak: streakAt(visits, now),
    longestStreak: visits.longestStreak,
  }
}
