import type { MetadataRoute } from "next"

import { AUTHOR_ROLES } from "@/access/roles"
import { MAX_SITEMAP_ENTRIES } from "@/app/(frontend)/(sitemaps)/sitemaps"
import { getPayloadClient } from "@/data/payload"
import { getSiteURL } from "@/utilities/getURL"

// Read per request, like the author pages it lists: Next would otherwise prerender it at build
// time, from the build's database.
export const dynamic = "force-dynamic"

/** /contributors/sitemap.xml: the /contributors index and every contributor it lists. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient()
  const siteUrl = getSiteURL()

  // The same authors as /contributors: staff who write, and anyone with a public profile.
  const { docs } = await payload.find({
    collection: "users",
    depth: 0,
    // One entry is the index page.
    limit: MAX_SITEMAP_ENTRIES - 1,
    pagination: false,
    sort: "name",
    where: {
      or: [{ roles: { in: AUTHOR_ROLES } }, { publicProfile: { equals: true } }],
    },
    select: { slug: true, updatedAt: true },
  })

  const authors = docs.flatMap((user) =>
    user.slug
      ? [{ url: `${siteUrl}/contributors/${user.slug}`, lastModified: user.updatedAt }]
      : [],
  )
  const newest = authors
    .map((author) => author.lastModified)
    .sort()
    .at(-1)

  return [...(newest ? [{ url: `${siteUrl}/contributors`, lastModified: newest }] : []), ...authors]
}
