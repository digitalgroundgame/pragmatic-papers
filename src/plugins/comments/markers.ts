import type { CollectionSlug, PayloadRequest, Where } from "payload"

import { COMMENTS_SLUG } from "./constants"
import type { StoredComment } from "./thread"
import type { AuthorDisplay, BadgeInfo, CommentAuthor, ResolvedCommentsConfig } from "./types"

// The marks beside a commenter's name that come and go: First comment, New commenter, New
// member and Cake day. Each thread read asks the database a fixed number of questions,
// however many people comment in it.

const DAY_MS = 24 * 60 * 60 * 1000

const authorIdOf = (author: StoredComment["author"]): string | null =>
  author === null || author === undefined
    ? null
    : String(typeof author === "object" ? author.id : author)

/**
 * Which of these authors published a comment before the time given for them, in one query.
 * Times are ISO strings; an author missing from `before` isn't asked about.
 */
async function publishedBefore(
  before: Map<string, string>,
  req: PayloadRequest,
): Promise<Set<string>> {
  if (before.size === 0) return new Set()
  const where: Where = {
    and: [
      { status: { equals: "published" } },
      {
        or: [...before].map(([author, time]): Where => ({
          and: [{ author: { equals: author } }, { createdAt: { less_than: time } }],
        })),
      },
    ],
  }
  const found = await req.payload.findDistinct({
    collection: COMMENTS_SLUG as CollectionSlug,
    field: "author",
    where,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return new Set(
    // The slug is the plugin's option, so the generated types can't name the field.
    (found.values as { author?: StoredComment["author"] }[]).flatMap(({ author }) => {
      const id = authorIdOf(author)
      return id === null ? [] : [id]
    }),
  )
}

/**
 * Which of these authors are new commenters: their first published comment is within the last
 * `newCommenterDays`, so none of theirs is older. Pass only authors with a published comment.
 */
export async function newCommenters(
  config: ResolvedCommentsConfig,
  authorIds: (number | string)[],
  req: PayloadRequest,
): Promise<Set<string>> {
  if (config.newCommenterDays <= 0) return new Set()
  const cutoff = new Date(Date.now() - config.newCommenterDays * DAY_MS).toISOString()
  const ids = [...new Set(authorIds.map(String))]
  const older = await publishedBefore(new Map(ids.map((id) => [id, cutoff])), req)
  return new Set(ids.filter((id) => !older.has(id)))
}

/**
 * Which of these comments (oldest first) is its author's first published comment on the site:
 * each author's earliest published one here, when they published nothing anywhere before it.
 */
export async function findFirstComments(
  stored: StoredComment[],
  req: PayloadRequest,
): Promise<Set<string>> {
  const earliest = new Map<string, StoredComment>()
  for (const comment of stored) {
    const authorId = authorIdOf(comment.author)
    if (comment.status !== "published" || authorId === null) continue
    if (!earliest.has(authorId)) earliest.set(authorId, comment)
  }
  const earlier = await publishedBefore(
    new Map([...earliest].map(([authorId, comment]) => [authorId, comment.createdAt])),
    req,
  )
  return new Set(
    [...earliest].flatMap(([authorId, comment]) =>
      earlier.has(authorId) ? [] : [String(comment.id)],
    ),
  )
}

/** Whether an account made at `createdAt` is within its first `days`. */
function isNewMember(createdAt: unknown, days: number): boolean {
  if (days <= 0 || (typeof createdAt !== "string" && !(createdAt instanceof Date))) return false
  const made = new Date(createdAt).getTime()
  return !Number.isNaN(made) && Date.now() - made < days * DAY_MS
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
 * `targetWriters`, New commenter for those of `commenters` (authors with a published comment)
 * who are new, New member for a new account, and Cake day on its anniversary. A badge
 * `describeAuthor` gives itself (like a staff role) wins.
 */
export async function describerFor(
  config: ResolvedCommentsConfig,
  authors: CommentAuthor[],
  req: PayloadRequest,
  targetId: number | string,
  commenters: (number | string)[] = [],
): Promise<(author: CommentAuthor) => AuthorDisplay> {
  const [badges, writers, newcomers] = authors.length
    ? await Promise.all([
        config.authorBadges(authors, req),
        config.targetWriters(targetId, req),
        newCommenters(config, commenters, req),
      ])
    : [new Map<string, BadgeInfo>(), [], new Set<string>()]
  const writerIds = new Set(writers.map(String))
  return (author) => {
    const display = config.describeAuthor(author)
    const described = display.badge
      ? display
      : { ...display, badge: badges.get(String(author.id)) ?? null }
    return {
      ...described,
      ...(writerIds.has(String(author.id)) && { writer: true as const }),
      ...(newcomers.has(String(author.id)) && { newcomer: true as const }),
      ...(isNewMember(author.createdAt, config.newMemberDays) && { newMember: true as const }),
      ...(isCakeDay(author.createdAt) && { cakeDay: true as const }),
    }
  }
}
