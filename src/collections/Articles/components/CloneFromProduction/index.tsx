import type { ListViewServerPropsOnly } from "payload"
import React from "react"

import { isAdmin } from "@/access/roles"
import type { User } from "@/payload-types"

import { CloneFromProductionMenuItem } from "./Client"

/** Item in the Articles list's ⋯ menu; registered only where cloning is allowed. */
export const CloneFromProduction: React.FC<ListViewServerPropsOnly> = ({ user }) => (
  <CloneFromProductionMenuItem allowed={isAdmin(user as User | undefined)} />
)
