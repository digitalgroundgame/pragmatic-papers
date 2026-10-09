import type { MetadataRoute } from "next"

import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { getServerSideURL } from "@/utilities/getURL"

// Read per request, like the topic pages it lists: Next would otherwise prerender it at build
// time, from the build's database.
export const dynamic = "force-dynamic"

/** /topics/sitemap.xml: the /topics index and every topic. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadConfig()
  const siteUrl = getServerSideURL().replace(/\/$/, "")

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
