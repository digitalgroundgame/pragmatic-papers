import { getServerSideSitemap } from "next-sitemap"

import { queryPublishedDocs } from "@/plugins/docs/queries"
import { getServerSideURL } from "@/utilities/getURL"

// The /docs index and each published doc. The list comes from the docs' data cache, which
// saving a doc or the start-up sync refreshes.
export async function GET(): Promise<Response> {
  const siteUrl = getServerSideURL().replace(/\/$/, "")
  const docs = await queryPublishedDocs()
  const newest = docs
    .map((doc) => doc.updatedAt)
    .sort()
    .at(-1)

  return getServerSideSitemap([
    ...(newest ? [{ loc: `${siteUrl}/docs`, lastmod: newest }] : []),
    ...docs.flatMap((doc) =>
      doc.slug ? [{ loc: `${siteUrl}/docs/${doc.slug}`, lastmod: doc.updatedAt }] : [],
    ),
  ])
}
