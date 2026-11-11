import type { CollectionSlug, Endpoint, PayloadHandler, PayloadRequest } from "payload"

import { normalizeCommentBody } from "../body"
import { COMMENTING_FIELD, commentingOf } from "../commenting"
import { duplicateCheck, linkCheck, runChecks } from "../checks"
import { COMMENTS_SLUG, VIOLATIONS_SLUG } from "../constants"
import { SKIP_MODERATION } from "../hooks/recordModeration"
import { authorLock } from "../lock"
import { readSettings } from "../settings"
import { buildThread, type StoredComment } from "../thread"
import type {
  AuthorDisplay,
  BadgeInfo,
  CommentAuthor,
  CommentThread,
  CommentViewer,
  PublicComment,
  ResolvedCommentsConfig,
} from "../types"

/** The most comments one thread reads: the newest, so a new comment always shows. */
export const THREAD_LIMIT = 500

const notFound = () => Response.json({ message: "Not Found" }, { status: 404 })
const noStore = { "Cache-Control": "private, no-store" }

function parseId(req: PayloadRequest, raw: unknown): number | string | null {
  if (typeof raw === "number" && req.payload.db.defaultIDType === "number") {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null
  }
  if (typeof raw !== "string" || !raw) return null
  if (req.payload.db.defaultIDType !== "number") return raw
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Which of these authors are new commenters: their first published comment is within the last
 * `newCommenterDays`, so none of theirs is older. Pass only authors with a published comment.
 * One count per author.
 */
export async function newCommenters(
  config: ResolvedCommentsConfig,
  authorIds: (number | string)[],
  req: PayloadRequest,
): Promise<Set<string>> {
  if (config.newCommenterDays <= 0) return new Set()
  const cutoff = new Date(Date.now() - config.newCommenterDays * DAY_MS).toISOString()
  const ids = [...new Set(authorIds.map(String))]
  const found = await Promise.all(
    ids.map(async (id) => {
      const older = await req.payload.count({
        collection: COMMENTS_SLUG as CollectionSlug,
        where: {
          author: { equals: id },
          status: { equals: "published" },
          createdAt: { less_than: cutoff },
        },
        overrideAccess: true,
        req,
      })
      return older.totalDocs === 0 ? id : null
    }),
  )
  return new Set(found.filter((id): id is string => id !== null))
}

/**
 * Which of these comments (oldest first) is its author's first published comment on the site:
 * each author's earliest published one here, when they published nothing anywhere before it.
 * One count per author shown.
 */
export async function findFirstComments(
  stored: StoredComment[],
  req: PayloadRequest,
): Promise<Set<string>> {
  const earliest = new Map<string, StoredComment>()
  for (const comment of stored) {
    if (comment.status !== "published" || !comment.author) continue
    const authorId = String(typeof comment.author === "object" ? comment.author.id : comment.author)
    if (!earliest.has(authorId)) earliest.set(authorId, comment)
  }
  const firsts = await Promise.all(
    [...earliest].map(async ([authorId, comment]) => {
      const before = await req.payload.count({
        collection: COMMENTS_SLUG as CollectionSlug,
        where: {
          author: { equals: authorId },
          status: { equals: "published" },
          createdAt: { less_than: comment.createdAt },
        },
        overrideAccess: true,
        req,
      })
      return before.totalDocs === 0 ? String(comment.id) : null
    }),
  )
  return new Set(firsts.filter((id): id is string => id !== null))
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
 * `targetWriters`, and the New commenter mark for those of `commenters` (authors with a
 * published comment) who are new, each asked once, New member for a new account, and Cake day
 * on its anniversary. A badge `describeAuthor` gives itself (like
 * a staff role) wins.
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

/** Whether a cross-site page sent this. A browser always names the page's origin on a POST. */
function isCrossSite(req: PayloadRequest, config: ResolvedCommentsConfig): boolean {
  const origin = req.headers.get("origin")
  return !origin || origin !== new URL(config.baseURL()).origin
}

const lockedMessage = (until: string | null) =>
  until
    ? "This account can't comment for now: too many of its comments were held or hidden."
    : "A moderator has stopped this account from commenting."

/**
 * `GET /api/comments/thread/:id`: a published document's comments as the viewer sees them
 * (404 for one that isn't published),
 * who the viewer is (if they're signed in) and the limits on posting.
 * `POST` posts a comment, or a reply (`parentId`), as the signed-in author.
 *
 * Neither is cached: the article page stays one cached copy for everyone, and loads its
 * comments from here once a reader scrolls to them.
 */
export function threadEndpoints(config: ResolvedCommentsConfig): Endpoint[] {
  const get: PayloadHandler = async (req) => {
    if (!(await config.enabled({ payload: req.payload }))) return notFound()
    const id = parseId(req, req.routeParams?.id)
    if (id === null) return notFound()

    const [target, found, author, settings] = await Promise.all([
      // Only what anyone can read shows its comments: an article taken down takes them with it.
      req.payload.findByID({
        collection: config.targetSlug,
        id,
        depth: 0,
        draft: false,
        overrideAccess: false,
        disableErrors: true,
        select: { [COMMENTING_FIELD]: true },
      }),
      req.payload.find({
        collection: COMMENTS_SLUG as CollectionSlug,
        where: { target: { equals: id } },
        sort: "-createdAt",
        limit: THREAD_LIMIT,
        depth: 1,
        populate: {
          // `createdAt` too, for the New member mark.
          [config.authorsSlug]: Object.fromEntries(
            [...config.authorFields, "createdAt"].map((f) => [f, true]),
          ),
        },
        select: {
          body: true,
          createdAt: true,
          status: true,
          depth: true,
          parent: true,
          author: true,
        },
        overrideAccess: true,
        req,
      }),
      config.currentUser(req),
      readSettings(req.payload),
    ])

    // Comments switched off on this document show nothing, as if there were none.
    const commenting = commentingOf(target)
    if (!target || commenting === "off") return notFound()

    const stored = (found.docs as unknown as StoredComment[]).reverse()
    const firstComments = await findFirstComments(stored, req)
    const describe = await describerFor(
      config,
      [
        ...stored.flatMap((comment) =>
          comment.author && typeof comment.author === "object" ? [comment.author] : [],
        ),
        ...(author ? [author] : []),
      ],
      req,
      id,
      stored.flatMap((comment) =>
        comment.status === "published" && comment.author && typeof comment.author === "object"
          ? [comment.author.id]
          : [],
      ),
    )

    let viewer: CommentViewer | null = null
    if (author) {
      viewer = {
        ...describe(author),
        locked: await authorLock(req.payload, author.id, settings),
        needsVerifiedEmail: settings.requireVerifiedEmail && !config.isVerified(author),
      }
    }

    const thread: CommentThread = {
      // Oldest first, as readers read them.
      comments: buildThread(stored, author?.id ?? null, describe, firstComments),
      viewer,
      providers: viewer ? [] : config.signInProviders(),
      maxDepth: settings.maxDepth,
      maxLength: config.maxLength,
      truncated: found.totalDocs > found.docs.length,
      ...(commenting === "locked" && { closed: true as const }),
    }
    return Response.json(thread, { headers: noStore })
  }

  const post: PayloadHandler = async (req) => {
    if (!(await config.enabled({ payload: req.payload }))) return notFound()
    const id = parseId(req, req.routeParams?.id)
    if (id === null) return notFound()
    if (isCrossSite(req, config)) {
      return Response.json({ message: "Post comments from the site itself." }, { status: 403 })
    }

    const author = await config.currentUser(req)
    if (!author) {
      return Response.json({ message: "Sign in to comment." }, { status: 401, headers: noStore })
    }
    const settings = await readSettings(req.payload)
    const lock = await authorLock(req.payload, author.id, settings)
    if (lock) {
      return Response.json(
        { message: lockedMessage(lock.until), lockedUntil: lock.until },
        { status: 403, headers: noStore },
      )
    }
    if (settings.requireVerifiedEmail && !config.isVerified(author)) {
      return Response.json(
        { message: "Commenting here needs a verified email address." },
        { status: 403, headers: noStore },
      )
    }

    const json = (await req.json?.().catch(() => null)) as {
      body?: unknown
      parentId?: unknown
    } | null
    const body = normalizeCommentBody(json?.body, config.maxLength)
    if (!body.ok) return Response.json({ message: body.message }, { status: 400 })

    // Only what anyone can read takes comments: published, with no staff access behind it.
    const target = await req.payload.findByID({
      collection: config.targetSlug,
      id,
      depth: 0,
      draft: false,
      overrideAccess: false,
      disableErrors: true,
      select: { [COMMENTING_FIELD]: true },
    })
    if (!target || commentingOf(target) === "off") return notFound()
    if (commentingOf(target) === "locked") {
      return Response.json(
        { message: "Comments are closed on this article." },
        { status: 403, headers: noStore },
      )
    }

    // A reply goes under a published comment on the same document, within the reply depth
    // the settings allow now. Replies already deeper than that stay where they are.
    let parentId: number | string | null = null
    let depth = 0
    if (json?.parentId !== undefined && json.parentId !== null) {
      parentId = parseId(req, json.parentId)
      const parent = parentId
        ? ((await req.payload.findByID({
            collection: COMMENTS_SLUG as CollectionSlug,
            id: parentId,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            select: { target: true, status: true, depth: true },
          })) as unknown as { target: number | string; status: string; depth?: number } | null)
        : null
      if (!parent || String(parent.target) !== String(id) || parent.status !== "published") {
        return Response.json(
          { message: "That comment is no longer there to reply to." },
          { status: 400 },
        )
      }
      depth = (parent.depth ?? 0) + 1
      if (depth > settings.maxDepth) {
        return Response.json(
          {
            message:
              settings.maxDepth === 0
                ? "Replies are off here."
                : `Replies are limited to ${settings.maxDepth} levels here.`,
          },
          { status: 400 },
        )
      }
    }

    const since = new Date(Date.now() - config.cooldownSeconds * 1000).toISOString()
    const recent = await req.payload.count({
      collection: COMMENTS_SLUG as CollectionSlug,
      where: { author: { equals: author.id }, createdAt: { greater_than: since } },
      overrideAccess: true,
      req,
    })
    if (recent.totalDocs > 0) {
      return Response.json(
        { message: "You just commented. Give it a few seconds before the next one." },
        { status: 429, headers: { ...noStore, "Retry-After": String(config.cooldownSeconds) } },
      )
    }

    const check = await runChecks([linkCheck, duplicateCheck, ...config.checks], {
      body: body.body,
      author,
      targetId: id,
      settings,
      req,
    })

    const created = (await req.payload.create({
      collection: COMMENTS_SLUG as CollectionSlug,
      // The slugs are the plugin's options, so the generated types can't name the fields.
      data: {
        body: body.body,
        target: id,
        author: author.id,
        parent: parentId,
        depth,
        status: check.ok ? "published" : "auto-hidden",
        moderationReason: check.ok ? null : check.reason,
      } as never,
      overrideAccess: true,
      context: { [SKIP_MODERATION]: true },
      req,
    })) as unknown as StoredComment

    if (!check.ok) {
      await req.payload.create({
        collection: VIOLATIONS_SLUG as CollectionSlug,
        data: {
          author: author.id,
          comment: created.id,
          source: "check",
          reason: check.reason,
        } as never,
        overrideAccess: true,
        req,
      })
    }

    const describe = await describerFor(config, [author], req, id, check.ok ? [author.id] : [])
    const posted = { ...created, author }
    const [comment] = buildThread(
      [posted],
      author.id,
      describe,
      await findFirstComments([posted], req),
    ) as [PublicComment]
    return Response.json(
      { comment, ...(!check.ok && { held: check.reason }) },
      { status: 201, headers: noStore },
    )
  }

  return [
    { path: "/thread/:id", method: "get", handler: get },
    { path: "/thread/:id", method: "post", handler: post },
  ]
}
