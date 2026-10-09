import type { MetadataRoute } from "next"

import { queryPublishedDocs } from "@/plugins/docs/queries"
import { getServerSideURL } from "@/utilities/getURL"

// Rendered per request from the docs' data cache, which saving a doc or a deploy's docs sync
// refreshes: Next would otherwise prerender it at build time, from the build's database.
export const dynamic = "force-dynamic"

/** /docs/sitemap.xml: the /docs index, as fresh as its newest doc, and each published doc. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getServerSideURL().replace(/\/$/, "")
  const docs = await queryPublishedDocs()
  const newest = docs
    .map((doc) => doc.updatedAt)
    .sort()
    .at(-1)

  return [
    ...(newest ? [{ url: `${siteUrl}/docs`, lastModified: newest }] : []),
    ...docs.flatMap((doc) =>
      doc.slug ? [{ url: `${siteUrl}/docs/${doc.slug}`, lastModified: doc.updatedAt }] : [],
    ),
  ]
}
