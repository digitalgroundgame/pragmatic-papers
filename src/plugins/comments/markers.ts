import type { PayloadRequest } from "payload"

import { FIRST_COMMENTED_FIELD } from "./constants"
import type { StoredComment } from "./thread"
import type { AuthorDisplay, BadgeInfo, CommentAuthor, ResolvedCommentsConfig } from "./types"

// The marks beside a commenter's name that come and go: First comment, New commenter, New
// member and Cake day. All four are read from the author's own record (`createdAt`, and the
// first-commented time the plugin keeps), so a thread asks the database nothing more for them.

const DAY_MS = 24 * 60 * 60 * 1000

const timeOf = (value: unknown): number | null => {
  if (typeof value !== "string" && !(value instanceof Date)) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/** When this author's earliest published comment was posted, from the field the plugin keeps. */
const firstCommentedAt = (author: CommentAuthor): number | null =>
  timeOf(author[FIRST_COMMENTED_FIELD])

/**
 * Whether this author is a new commenter: their first published comment is within the last
 * `days`.
 */
export function isNewCommenter(author: CommentAuthor, days: number): boolean {
  const first = firstCommentedAt(author)
  return days > 0 && first !== null && Date.now() - first < days * DAY_MS
}

/**
 * Which of these comments is its author's first published comment on the site: the one
 * posted when their first-commented time says.
 */
export function findFirstComments(stored: StoredComment[]): Set<string> {
  return new Set(
    stored.flatMap((comment) => {
      const author = comment.author
      if (comment.status !== "published" || !author || typeof author !== "object") return []
      const first = firstCommentedAt(author)
      return first !== null && first === timeOf(comment.createdAt) ? [String(comment.id)] : []
    }),
  )
}

/** Whether an account made at `createdAt` is within its first `days`. */
function isNewMember(createdAt: unknown, days: number): boolean {
  const made = timeOf(createdAt)
  return days > 0 && made !== null && Date.now() - made < days * DAY_MS
}

/**
 * Whether `now` falls on an anniversary of `createdAt`, by the UTC calendar, from a year on.
 * An account made on 29 February has its cake day on the 28th in other years.
 */
export function isCakeDay(createdAt: unknown, now: Date = new Date()): boolean {
  if (typeof createdAt !== "string" && !(createdAt instanceof Date)) return false
  const made = new Date(createdAt)
  if (Number.isNaN(made.getTime()) || now.getUTCFullYear() <= made.getUTCFullYear()) return false
  const year = now.getUTCFullYear()
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const month = made.getUTCMonth()
  const day = month === 1 && made.getUTCDate() === 29 && !leap ? 28 : made.getUTCDate()
  return now.getUTCMonth() === month && now.getUTCDate() === day
}

/**
 * `describeAuthor`, with the badges `authorBadges` gives these authors, the writer mark for
 * `targetWriters`, New commenter for a first comment within `newCommenterDays`, New member for
 * a new account, and Cake day on its anniversary. A badge
 * `describeAuthor` gives itself (like a staff role) wins.
 */
export async function describerFor(
  config: ResolvedCommentsConfig,
  authors: CommentAuthor[],
  req: PayloadRequest,
  targetId: number | string,
): Promise<(author: CommentAuthor) => AuthorDisplay> {
  const [badges, writers] = authors.length
    ? await Promise.all([config.authorBadges(authors, req), config.targetWriters(targetId, req)])
    : [new Map<string, BadgeInfo>(), []]
  const writerIds = new Set(writers.map(String))
  return (author) => {
    const display = config.describeAuthor(author)
    const described = display.badge
      ? display
      : { ...display, badge: badges.get(String(author.id)) ?? null }
    return {
      ...described,
      ...(writerIds.has(String(author.id)) && { writer: true as const }),
      ...(isNewCommenter(author, config.newCommenterDays) && { newcomer: true as const }),
      ...(isNewMember(author.createdAt, config.newMemberDays) && { newMember: true as const }),
      ...(isCakeDay(author.createdAt) && { cakeDay: true as const }),
    }
  }
}
