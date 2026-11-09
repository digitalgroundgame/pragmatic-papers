import type { Article } from "@/payload-types"
import type { FieldHook, TextFieldSingleValidation } from "payload"

/**
 * Whether a URL is an `https://` address on Substack: `substack.com` (the app's own post
 * links) or a publication's `<name>.substack.com`. Substack has no API and its importer
 * reports nothing back, so an editor pastes the imported post's address by hand, and this
 * catches most wrong pastes.
 */
export function isSubstackUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  const host = url.hostname.toLowerCase()
  return host === "substack.com" || host.endsWith(".substack.com")
}

export const validateSubstackUrl: TextFieldSingleValidation = (value) => {
  if (!value?.trim()) return true
  return (
    isSubstackUrl(value.trim()) ||
    "Paste the post's address on Substack, starting with https:// (for example https://thepragmaticpapers.substack.com/p/…)."
  )
}

/** A pasted address without its surrounding spaces; nothing when the field was cleared. */
export function cleanSubstackUrl(value: string | null | undefined): string | null {
  return value?.trim() || null
}

/** Left alone when a save doesn't send the field, so a partial update keeps the address. */
export const trimSubstackUrl: FieldHook<Article, Article["substackUrl"]> = ({ value }) =>
  value === undefined ? value : cleanSubstackUrl(value)

/**
 * The article's post on Substack, for the "Read on Substack" link: only while the article is
 * still syndicated, so unticking the box takes the link down along with the field.
 */
export function substackPostUrl(
  article: Pick<Article, "syndicateToSubstack" | "substackUrl">,
): string | null {
  if (!article.syndicateToSubstack) return null
  const url = cleanSubstackUrl(article.substackUrl)
  return url && isSubstackUrl(url) ? url : null
}
