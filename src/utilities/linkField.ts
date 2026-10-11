import type { LinkField } from "@/payload-types"

import { docPath } from "./routes"

/**
 * Whether the link points at a document that exists but isn't published. Nav menus leave such
 * a link out rather than send readers to a 404; the global's cached copy populates linked
 * documents without read access checks, so a draft still comes back populated.
 */
export function linksToUnpublished(link?: LinkField): boolean {
  const value = link?.type === "reference" ? link.reference?.value : undefined
  return typeof value === "object" && value !== null && "_status" in value
    ? value._status === "draft"
    : false
}

/**
 * Where a link field points: the linked document's path (`docPath`), or its custom URL.
 * `null` when it has neither, including a reference whose document wasn't populated.
 */
export function linkHref(link?: LinkField): string | null {
  if (!link) return null
  const reference = link.type === "reference" ? link.reference : undefined
  if (typeof reference?.value === "object" && reference.value.slug) {
    return docPath(reference.relationTo, reference.value.slug)
  }
  return link.url || null
}
