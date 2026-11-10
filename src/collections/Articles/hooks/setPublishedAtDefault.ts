import type { FieldHook } from "payload"
import type { Article } from "@/payload-types"

/**
 * Field `beforeChange` hook for `publishedAt`: an article published without a date gets
 * now. A date an editor picked is kept, and a draft stays undated.
 */
export const setPublishedAtDefault: FieldHook<Article, Article["publishedAt"]> = ({
  siblingData,
  value,
}) => {
  if (siblingData && siblingData._status === "published" && !value) {
    return new Date().toISOString()
  }

  return value
}
