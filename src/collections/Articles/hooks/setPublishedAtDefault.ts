import type { FieldHook, RequestContext } from "payload"
import type { Article } from "@/payload-types"

/**
 * The time a publish in this request is stamped with. Payload runs sibling fields' hooks
 * side by side, so a hook can't count on reading the date another field's hook has just
 * set: each asks here, and the fields agree to the millisecond.
 */
export function publishTime(context: RequestContext | undefined): string {
  const kept: unknown = context?.publishTime
  if (typeof kept === "string") return kept

  const now = new Date().toISOString()
  if (context) context.publishTime = now
  return now
}

/**
 * Field `beforeChange` hook for `publishedAt`: an article published without a date gets
 * now. A date an editor picked is kept, and a draft stays undated.
 */
export const setPublishedAtDefault: FieldHook<Article, Article["publishedAt"]> = ({
  context,
  siblingData,
  value,
}) => {
  if (siblingData && siblingData._status === "published" && !value) {
    return publishTime(context)
  }

  return value
}
