import type { BeforeListTableServerProps } from "payload"
import React from "react"

import { isAdmin } from "@/access/roles"
import { canCloneFromProduction } from "@/collections/Articles/endpoints/cloneFromProduction"
import type { User } from "@/payload-types"

import { CloneFromProductionClient } from "./Client"

export const CloneFromProduction: React.FC<BeforeListTableServerProps> = ({ user }) => {
  if (!canCloneFromProduction() || !isAdmin(user as User | undefined)) return null
  return <CloneFromProductionClient />
}
