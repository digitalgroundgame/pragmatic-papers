import type { CollectionSlug } from "payload"

import { COMMENTS_SLUG } from "./constants"
import type { CommentCheck, CommentCheckArgs, CommentCheckResult } from "./types"

const LINK = /\bhttps?:\/\/|\bwww\./gi

/** How many links a comment holds. */
export function countLinks(body: string): number {
  return body.match(LINK)?.length ?? 0
}

/** Holds a comment with more links than the settings allow. */
export const linkCheck: CommentCheck = ({ body, settings }) =>
  countLinks(body) > settings.maxLinks
    ? { ok: false, reason: `More than ${settings.maxLinks} links` }
    : { ok: true }

/** Holds a comment its author already posted, word for word, in the past day. */
export const duplicateCheck: CommentCheck = async ({ body, author, settings, req }) => {
  if (!settings.blockDuplicates) return { ok: true }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { totalDocs } = await req.payload.count({
    collection: COMMENTS_SLUG as CollectionSlug,
    where: {
      author: { equals: author.id },
      body: { equals: body },
      createdAt: { greater_than: since },
    },
    overrideAccess: true,
    req,
  })
  return totalDocs > 0 ? { ok: false, reason: "Repeats an earlier comment" } : { ok: true }
}

/** Runs each check in turn and stops at the first that fails. */
export async function runChecks(
  checks: CommentCheck[],
  args: CommentCheckArgs,
): Promise<CommentCheckResult> {
  for (const check of checks) {
    const result = await check(args)
    if (!result.ok) return result
  }
  return { ok: true }
}
