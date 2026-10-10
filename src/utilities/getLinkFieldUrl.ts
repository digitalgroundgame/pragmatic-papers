import type { LinkField } from "@/payload-types"

import { docPath } from "./routes"

/**
 * Generates a URL string from a given LinkField object.
 *
 * - If the link is a reference type with a valid `slug`, constructs a path:
 *    - If the reference is in the 'pages' collection and its slug is 'home', returns root ('/').
 *    - If the relationTo is NOT 'pages', prepends `/${relationTo}` to the path.
 *    - Appends `/${slug}` for the final URL.
 * - If the link is not a reference, returns the direct `url` property if available.
 * - Returns `null` if the link is undefined or lacks usable URL information.
 *
 * @param {LinkField | undefined} link - The link field object from Payload CMS.
 * @returns {string | null} - The resolved URL or null if unavailable.
 */
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

export function getLinkFieldUrl(link?: LinkField): string | null {
  if (!link) return null
  const reference = link.type === "reference" ? link.reference : undefined
  if (typeof reference?.value === "object" && reference.value.slug) {
    return docPath(reference.relationTo, reference.value.slug)
  }
  return link.url || null
}
