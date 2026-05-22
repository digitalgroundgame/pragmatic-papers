import type { PayloadRequest } from "payload"
import { collectMediaReferences } from "@/utilities/collectMediaReferences"

export async function referencesHandler(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const mediaId = parseInt(req.routeParams?.id as string, 10)
  if (isNaN(mediaId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 })
  }

  const refs = await collectMediaReferences(req.payload, mediaId)

  return Response.json({ references: refs })
}
