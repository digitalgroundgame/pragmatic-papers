import type { MetadataRoute } from "next"

import { queryPublishedDocs } from "@/plugins/docs/queries"
import { docPath, WHATS_NEW_PATH } from "@/plugins/docs/sections"
import { getSiteURL } from "@/utilities/getURL"

// Rendered per request from the docs' data cache, which saving a doc or a deploy's docs sync
// refreshes: Next would otherwise prerender it at build time, from the build's database.
export const dynamic = "force-dynamic"

/**
 * /docs/sitemap.xml: each published doc, the home doc at /docs, and What's new, as fresh as its
 * newest doc.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteURL().replace(/\/$/, "")
  const docs = await queryPublishedDocs()
  const newest = docs
    .map((doc) => doc.updatedAt)
    .sort()
    .at(-1)

  return [
    ...docs.flatMap((doc) =>
      doc.slug ? [{ url: `${siteUrl}${docPath(doc.slug)}`, lastModified: doc.updatedAt }] : [],
    ),
    ...(newest ? [{ url: `${siteUrl}${WHATS_NEW_PATH}`, lastModified: newest }] : []),
  ]
}
