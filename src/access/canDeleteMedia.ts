import type { Access } from "payload"
import { atLeast } from "./roles"
import { collectMediaReferences } from "@/utilities/collectMediaReferences"

export const canDeleteMedia: Access = async ({ req: { user, payload }, id }) => {
  if (!user) return false

  // When checking a specific document, prevent deletion if media is referenced in published content
  if (id && payload) {
    const refs = await collectMediaReferences(payload, id)
    if (refs.length > 0) return false
  }

  // Standard permission: editors can delete any, others can only delete their own
  return atLeast(user, "editor") || { createdBy: { equals: user.id } }
}
