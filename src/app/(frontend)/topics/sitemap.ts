import type { MetadataRoute } from "next"

import { getPayloadClient } from "@/data/payload"
import { getSiteURL } from "@/utilities/getURL"

// Read per request, like the topic pages it lists: Next would otherwise prerender it at build
// time, from the build's database.
export const dynamic = "force-dynamic"

/** /topics/sitemap.xml: the /topics index and every topic. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient()
  const siteUrl = getSiteURL()

  const { docs } = await payload.find({
    collection: "topics",
    depth: 0,
    limit: 5000,
    overrideAccess: false,
    pagination: false,
    sort: "name",
    select: { slug: true, updatedAt: true },
  })

  const topics = docs.flatMap((topic) =>
    topic.slug ? [{ url: `${siteUrl}/topics/${topic.slug}`, lastModified: topic.updatedAt }] : [],
  )
  const newest = topics
    .map((topic) => topic.lastModified)
    .sort()
    .at(-1)

  return [...(newest ? [{ url: `${siteUrl}/topics`, lastModified: newest }] : []), ...topics]
}
