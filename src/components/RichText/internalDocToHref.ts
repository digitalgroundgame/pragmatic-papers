import type { SerializedLinkNode } from "@payloadcms/richtext-lexical"

/**
 * Resolve an internal Lexical link node to a site path.
 *
 * Lives in its own module because client components need it — the media
 * lightbox builds its own converter for captions — while `RichText` itself is
 * server-only. Importing this from there would pull the server-only converter
 * map, and the Payload config behind it, into the browser bundle.
 */
export const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
  const { value, relationTo } = linkNode.fields.doc!
  if (typeof value !== "object") {
    throw new Error("Expected value to be an object")
  }
  const slug = value.slug
  return relationTo === "articles" ? `/articles/${slug}` : `/${slug}`
}
