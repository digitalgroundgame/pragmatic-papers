import type { CollectionSlug, Endpoint, PayloadHandler, PayloadRequest } from "payload"

import { normalizeCommentBody } from "../body"
import { duplicateCheck, linkCheck, runChecks } from "../checks"
import { COMMENTS_SLUG, VIOLATIONS_SLUG } from "../constants"
import { SKIP_MODERATION } from "../hooks/recordModeration"
import { authorLock } from "../lock"
import { readSettings } from "../settings"
import { buildThread, type StoredComment } from "../thread"
import type { CommentThread, CommentViewer, PublicComment, ResolvedCommentsConfig } from "../types"

/** The most comments one thread reads, oldest first. */
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
 * `GET /api/comments/thread/:id`: a published document's comments as the viewer sees them,
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

    const [found, author, settings] = await Promise.all([
      req.payload.find({
        collection: COMMENTS_SLUG as CollectionSlug,
        where: { target: { equals: id } },
        sort: "createdAt",
        limit: THREAD_LIMIT,
        depth: 1,
        populate: {
          [config.authorsSlug]: Object.fromEntries(config.authorFields.map((f) => [f, true])),
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

    let viewer: CommentViewer | null = null
    if (author) {
      viewer = {
        ...config.describeAuthor(author),
        locked: await authorLock(req.payload, author.id, settings),
      }
    }

    const thread: CommentThread = {
      comments: buildThread(
        found.docs as unknown as StoredComment[],
        author?.id ?? null,
        config.describeAuthor,
      ),
      viewer,
      providers: viewer ? [] : config.signInProviders(),
      maxDepth: settings.maxDepth,
      maxLength: config.maxLength,
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
      select: {},
    })
    if (!target) return notFound()

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

    const [comment] = buildThread([{ ...created, author }], author.id, config.describeAuthor) as [
      PublicComment,
    ]
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
