import type { SerializedLinkNode } from "@payloadcms/richtext-lexical"
import type { CollectionSlug } from "payload"

/** The path each collection's documents are served under, before the slug. */
export const COLLECTION_PATHS = {
  pages: "",
  articles: "/articles",
  volumes: "/volumes",
  topics: "/topics",
  interactives: "/interactives",
} as const satisfies Partial<Record<CollectionSlug, string>>

/** A collection whose documents have a public page. */
export type RoutedCollection = keyof typeof COLLECTION_PATHS

/** The slug of the page served at the site root. */
export const HOME_SLUG = "home"

/**
 * The site path of a document, from its collection and slug: `/articles/the-case`,
 * `/about` for a page, `/` for the home page. A collection without an entry in
 * `COLLECTION_PATHS` is served under its own slug.
 */
export function docPath(collection: string, slug: string): string {
  if (collection === "pages" && slug === HOME_SLUG) return "/"
  const prefix =
    collection in COLLECTION_PATHS
      ? COLLECTION_PATHS[collection as RoutedCollection]
      : `/${collection}`
  return `${prefix}/${slug}`
}

/**
 * The site path an internal Lexical link points at, for Payload's `LinkJSXConverter` and
 * `LinkHTMLConverter`. Throws when the linked document wasn't populated (the content was
 * read at too low a depth), so a caller can fall back rather than link to `#`.
 *
 * Types only from `@payloadcms/richtext-lexical`: client components (the media lightbox's
 * captions) import this, and the package's runtime would pull the server converters in.
 */
export const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
  const { value, relationTo } = linkNode.fields.doc!
  if (typeof value !== "object") {
    throw new Error("Expected value to be an object")
  }
  return docPath(relationTo, String(value.slug))
}
