import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionSlug,
  Field,
  PayloadRequest,
} from "payload"

import { COMMENTS_SLUG, FIRST_COMMENTED_FIELD } from "../constants"
import type { ResolvedCommentsConfig } from "../types"

/** Set by a bulk delete that brings its authors' fields up to date itself, once each. */
export const SKIP_FIRST_COMMENTED = "commentsSkipFirstCommented"

const relationId = (value: unknown): number | string | null =>
  value && typeof value === "object"
    ? (value as { id: number | string }).id
    : ((value as number | string | null | undefined) ?? null)

const timeOf = (value: unknown): number | null =>
  typeof value === "string" || value instanceof Date ? new Date(value).getTime() : null

/** The authors' field: read-only, and written only by the plugin. */
export const firstCommentedField = (): Field => ({
  name: FIRST_COMMENTED_FIELD,
  label: "First commented",
  type: "date",
  access: { create: () => false, update: () => false },
  admin: {
    readOnly: true,
    position: "sidebar",
    date: { pickerAppearance: "dayAndTime" },
    description: "When their earliest published comment was posted. Comments keep it up to date.",
  },
})

/**
 * Sets the author's field to their earliest published comment's time, or empties it when they
 * have none, writing only when it changes.
 */
export async function refreshFirstCommented(
  config: ResolvedCommentsConfig,
  authorId: number | string,
  req: PayloadRequest,
): Promise<void> {
  const [author, earliest] = await Promise.all([
    req.payload.findByID({
      collection: config.authorsSlug,
      id: authorId,
      depth: 0,
      // The slug is the plugin's option, so the generated types can't name the field.
      select: { [FIRST_COMMENTED_FIELD]: true } as never,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
    req.payload.find({
      collection: COMMENTS_SLUG as CollectionSlug,
      where: { author: { equals: authorId }, status: { equals: "published" } },
      sort: "createdAt",
      limit: 1,
      pagination: false,
      depth: 0,
      select: { createdAt: true },
      overrideAccess: true,
      req,
    }),
  ])
  if (!author) return
  const first = (earliest.docs[0] as { createdAt?: string } | undefined)?.createdAt ?? null
  const stored = (author as unknown as Record<string, unknown>)[FIRST_COMMENTED_FIELD]
  if (timeOf(stored) === timeOf(first)) return
  // Nothing readers see changes, so the host's revalidation hooks skip it. Payload keeps the
  // context on `req`, so put it back for whatever the request does next.
  const context = req.context
  try {
    await req.payload.update({
      collection: config.authorsSlug,
      id: authorId,
      data: { [FIRST_COMMENTED_FIELD]: first } as never,
      depth: 0,
      overrideAccess: true,
      context: { disableRevalidate: true },
      req,
    })
  } finally {
    req.context = context
  }
}

/**
 * Keeps each author's field in step with their comments: a comment posted, published, hidden,
 * held or deleted can change which of theirs is earliest.
 */
export const syncFirstCommentedOnChange =
  (config: ResolvedCommentsConfig): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req }) => {
    const authorId = relationId(doc.author)
    // An author whose account is going has no field left to keep.
    if (authorId === null) return doc
    const changed =
      operation === "create"
        ? doc.status === "published"
        : previousDoc?.status !== doc.status &&
          (previousDoc?.status === "published" || doc.status === "published")
    if (changed) await refreshFirstCommented(config, authorId, req)
    return doc
  }

export const syncFirstCommentedOnDelete =
  (config: ResolvedCommentsConfig): CollectionAfterDeleteHook =>
  async ({ doc, req }) => {
    const authorId = relationId(doc.author)
    if (authorId === null || doc.status !== "published" || req.context[SKIP_FIRST_COMMENTED]) {
      return doc
    }
    await refreshFirstCommented(config, authorId, req)
    return doc
  }
