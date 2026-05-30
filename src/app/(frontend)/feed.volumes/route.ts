import { type NextRequest } from "next/server"
import configPromise from "@payload-config"
import { getPayload } from "payload"
import { generateVolumeFeed } from "@/utilities/generateRssFeed"
import { cache } from "react"

const queryVolumes = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const volumes = await payload.find({
    collection: "volumes",
    draft: false,
    limit: 20,
    overrideAccess: false,
    pagination: false,
    where: {
      _status: {
        equals: "published",
      },
    },
    sort: "-publishedAt",
    depth: 1,
  })

  return volumes.docs || []
})

export async function GET(_request: NextRequest): Promise<Response> {
  const volumes = await queryVolumes()
  const feed = generateVolumeFeed(volumes)

  return new Response(feed, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=600",
    },
  })
}

export const dynamic = "force-static"
