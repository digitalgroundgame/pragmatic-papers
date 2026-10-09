import type { MetadataRoute } from "next"

import { AUTHOR_ROLES } from "@/access/roles"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { getServerSideURL } from "@/utilities/getURL"

// Read per request, like the author pages it lists: Next would otherwise prerender it at build
// time, from the build's database.
export const dynamic = "force-dynamic"

/** /authors/sitemap.xml: the /authors index and every author it lists. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadConfig()
  const siteUrl = getServerSideURL().replace(/\/$/, "")

  // The same authors as /authors: staff who write, and anyone with a public profile.
  const { docs } = await payload.find({
    collection: "users",
    depth: 0,
    limit: 5000,
    pagination: false,
    sort: "name",
    where: {
      or: [{ roles: { in: AUTHOR_ROLES } }, { publicProfile: { equals: true } }],
    },
    select: { slug: true, updatedAt: true },
  })

  const authors = docs.flatMap((user) =>
    user.slug ? [{ url: `${siteUrl}/authors/${user.slug}`, lastModified: user.updatedAt }] : [],
  )
  const newest = authors
    .map((author) => author.lastModified)
    .sort()
    .at(-1)

  return [...(newest ? [{ url: `${siteUrl}/authors`, lastModified: newest }] : []), ...authors]
}
