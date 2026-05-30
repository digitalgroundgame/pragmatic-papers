import type { PayloadRequest } from "payload"

import type { RegenerateBlurResponse } from "@/collections/Media/types"
import { getBlurDataUrlFromBuffer } from "@/utilities/getBlurDataUrlFromBuffer"
import { getServerSideURL } from "@/utilities/getURL"

export async function regenerateBlurHandler(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const mediaId = parseInt(req.routeParams?.id as string, 10)
  if (isNaN(mediaId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 })
  }

  const media = await req.payload.findByID({
    collection: "media",
    id: mediaId,
    overrideAccess: false,
    user: req.user,
  })

  if (!media.mimeType?.startsWith("image/")) {
    return Response.json({ error: "Media is not an image" }, { status: 400 })
  }

  if (!media.url) {
    return Response.json({ error: "Media has no URL" }, { status: 400 })
  }

  const imageUrl = media.url.startsWith("http") ? media.url : `${getServerSideURL()}${media.url}`

  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    return Response.json({ error: "Failed to fetch image" }, { status: 500 })
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  const blurDataURL = await getBlurDataUrlFromBuffer(imageBuffer)

  await req.payload.update({
    collection: "media",
    id: mediaId,
    data: { blurDataURL },
    overrideAccess: false,
    user: req.user,
  })

  return Response.json({ blurDataURL } satisfies RegenerateBlurResponse)
}
