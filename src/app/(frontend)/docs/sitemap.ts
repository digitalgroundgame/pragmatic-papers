import type { MetadataRoute } from "next"

import { isPluginEnabled } from "@/globals/Plugins/isPluginEnabled"
import { queryPublishedDocs } from "@/plugins/docs/queries"
import { docPaths, docsTree, WHATS_NEW_PATH } from "@/plugins/docs/sections"
import { getSiteURL } from "@/utilities/getURL"

// Rendered per request from the docs' data cache, which saving a doc or a deploy's docs sync
// refreshes: Next would otherwise prerender it at build time, from the build's database.
export const dynamic = "force-dynamic"

/**
 * /docs/sitemap.xml: each published doc at its place in the tree, the home doc at /docs, and
 * What's new, as fresh as its newest doc.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await isPluginEnabled("docs"))) return []
  const siteUrl = getSiteURL().replace(/\/$/, "")
  const docs = await queryPublishedDocs()
  const paths = docPaths(docsTree(docs))
  const newest = docs
    .map((doc) => doc.updatedAt)
    .sort()
    .at(-1)

  return [
    ...docs.flatMap((doc) => {
      const path = paths.get(doc.slug)
      return path ? [{ url: `${siteUrl}${path}`, lastModified: doc.updatedAt }] : []
    }),
    ...(newest ? [{ url: `${siteUrl}${WHATS_NEW_PATH}`, lastModified: newest }] : []),
  ]
}
