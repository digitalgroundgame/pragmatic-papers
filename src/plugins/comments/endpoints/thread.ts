import type { CollectionSlug, Endpoint, PayloadHandler, PayloadRequest } from "payload"

import { configuredProviders } from "../auth"
import { normalizeCommentBody } from "../body"
import { COMMENTS_SLUG } from "../constants"
import { currentReader, type Reader } from "../reader"
import type { CommentThread, PublicComment, ResolvedCommentsConfig } from "../types"

/** The most comments one thread returns, oldest first. */
export const THREAD_LIMIT = 500

const notFound = () => Response.json({ message: "Not Found" }, { status: 404 })
const noStore = { "Cache-Control": "private, no-store" }

interface StoredComment {
  id: number | string
  body: string
  createdAt: string
  reader?: Reader | number | string | null
}

/** What anyone may read about a comment: its words, when, and its author's public name. */
export function toPublicComment(comment: StoredComment): PublicComment | null {
  const { reader } = comment
  // Its reader was deleted, or didn't populate.
  if (!reader || typeof reader !== "object") return null
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    author: { name: reader.name, image: reader.avatarUrl ?? null },
  }
}

function targetId(req: PayloadRequest): number | string | null {
  const raw = req.routeParams?.id
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

/**
 * `GET /api/comments/thread/:id`: a published document's published comments, the reader
 * asking (if they're signed in) and the providers they could sign in with.
 * `POST` posts a comment on it as the signed-in reader.
 *
 * Neither is cached: the article page stays one cached copy for everyone, and loads its
 * comments from here once a reader scrolls to them.
 */
export function threadEndpoints(config: ResolvedCommentsConfig): Endpoint[] {
  const get: PayloadHandler = async (req) => {
    if (!(await config.enabled({ payload: req.payload }))) return notFound()
    const id = targetId(req)
    if (id === null) return notFound()

    const [found, reader] = await Promise.all([
      req.payload.find({
        collection: COMMENTS_SLUG as CollectionSlug,
        where: { target: { equals: id }, status: { equals: "published" } },
        sort: "createdAt",
        limit: THREAD_LIMIT,
        depth: 1,
        populate: { readers: { name: true, avatarUrl: true } },
        select: { body: true, createdAt: true, reader: true },
        overrideAccess: true,
        req,
      }),
      currentReader(req, config),
    ])

    const thread: CommentThread = {
      comments: (found.docs as unknown as StoredComment[])
        .map(toPublicComment)
        .filter((c): c is PublicComment => c !== null),
      viewer: reader
        ? { name: reader.name, image: reader.avatarUrl ?? null, banned: reader.banned === true }
        : null,
      providers: configuredProviders(config),
      maxLength: config.maxLength,
    }
    return Response.json(thread, { headers: noStore })
  }

  const post: PayloadHandler = async (req) => {
    if (!(await config.enabled({ payload: req.payload }))) return notFound()
    const id = targetId(req)
    if (id === null) return notFound()
    if (isCrossSite(req, config)) {
      return Response.json({ message: "Post comments from the site itself." }, { status: 403 })
    }

    const reader = await currentReader(req, config)
    if (!reader) {
      return Response.json({ message: "Sign in to comment." }, { status: 401, headers: noStore })
    }
    if (reader.banned) {
      return Response.json(
        { message: "A moderator has stopped this account from commenting." },
        { status: 403, headers: noStore },
      )
    }

    const json = (await req.json?.().catch(() => null)) as { body?: unknown } | null
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

    const since = new Date(Date.now() - config.cooldownSeconds * 1000).toISOString()
    const recent = await req.payload.count({
      collection: COMMENTS_SLUG as CollectionSlug,
      where: { reader: { equals: reader.id }, createdAt: { greater_than: since } },
      overrideAccess: true,
      req,
    })
    if (recent.totalDocs > 0) {
      return Response.json(
        { message: "You just commented. Give it a few seconds before the next one." },
        { status: 429, headers: { ...noStore, "Retry-After": String(config.cooldownSeconds) } },
      )
    }

    const created = (await req.payload.create({
      collection: COMMENTS_SLUG as CollectionSlug,
      // The slugs are the plugin's options, so the generated types can't name the fields.
      data: { body: body.body, target: id, reader: reader.id, status: "published" } as never,
      overrideAccess: true,
      req,
    })) as unknown as StoredComment

    const comment = toPublicComment({ ...created, reader })
    return Response.json({ comment }, { status: 201, headers: noStore })
  }

  return [
    { path: "/thread/:id", method: "get", handler: get },
    { path: "/thread/:id", method: "post", handler: post },
  ]
}
