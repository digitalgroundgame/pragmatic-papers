import type { LinkField } from "@/payload-types"

/**
 * Generates a URL string from a given LinkField object.
 *
 * - If the link is a reference type with a valid `slug`, constructs a path:
 *    - If the reference slug is 'home', returns root ('/').
 *    - If the relationTo is NOT 'pages', prepends `/${relationTo}` to the path.
 *    - Appends `/${slug}` for the final URL.
 * - If the link is not a reference, returns the direct `url` property if available.
 * - Returns `null` if the link is undefined or lacks usable URL information.
 *
 * @param {LinkField | undefined} link - The link field object from Payload CMS.
 * @returns {string | null} - The resolved URL or null if unavailable.
 */
export function getLinkFieldUrl(link?: LinkField): string | null {
  if (!link) return null
  if (
    link.type === "reference" &&
    typeof link.reference?.value === "object" &&
    link.reference?.value.slug
  ) {
    if (link.reference?.value.slug === "home") {
      return "/"
    }

    let url = ""
    if (link.reference?.relationTo !== "pages") {
      url += `/${link.reference?.relationTo}`
    }

    url += `/${link.reference?.value.slug}`
    return url
  }
  return link.url || null
}
