import type { PayloadRequest } from "payload"
import { isStaff } from "@/access/roles"
import { collectMediaReferences } from "../references/collectMediaReferences"

export async function referencesHandler(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  // The lookup reads with overrideAccess (it has to see every document), so it is
  // limited to the same staff who can upload and edit media.
  if (!isStaff(req.user)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const mediaId = parseInt(req.routeParams?.id as string, 10)
  if (isNaN(mediaId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 })
  }

  const refs = await collectMediaReferences(req.payload, mediaId)

  return Response.json({ references: refs })
}
