import type { FieldHook } from "payload"

import type { Role } from "@/access/roles"
import type { User } from "@/payload-types"

/**
 * Derives a boolean from `roles`. A save can leave `roles` out (non-admins
 * can't update it), so it falls back to the stored roles.
 */
export const populateRoleFlag =
  (flagRoles: Role[]): FieldHook<User, boolean, User> =>
  ({ originalDoc, siblingData }) =>
    (siblingData.roles ?? originalDoc?.roles ?? []).some((role) => flagRoles.includes(role))
