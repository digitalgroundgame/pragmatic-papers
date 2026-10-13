import type { UIFieldServerProps } from "payload"

import { isAdmin } from "@/access/roles"
import type { User } from "@/payload-types"

import { loadPlugins } from "./load"
import { PluginsTable } from "./PluginsTable"

/** The list of installed plugins at the top of System → Plugins, above their switches. */
export async function PluginsField({ payload, req }: UIFieldServerProps): Promise<React.ReactNode> {
  const user = req.user as User | null
  if (!isAdmin(user)) return null
  return <PluginsTable plugins={await loadPlugins(payload, user)} />
}
