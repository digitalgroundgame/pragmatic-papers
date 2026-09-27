import type { FilterOptions } from "payload"

import { AUTHOR_ROLES } from "@/access/roles"

/**
 * Limits `authors` to users who can be credited. Users' `roles` are readable
 * only by the user themselves and admins, and Payload runs this filter with
 * the caller's access (to validate a save and to fill the admin picker), so
 * the roles are matched here with access overridden and only ids go back.
 */
export const authorFilterOptions: FilterOptions = async ({ req }) => {
  const { docs } = await req.payload.find({
    collection: "users",
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
    select: {},
    where: { roles: { in: AUTHOR_ROLES } },
  })
  return { id: { in: docs.map((doc) => doc.id) } }
}
