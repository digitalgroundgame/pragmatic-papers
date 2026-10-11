import { Gutter, SetStepNav } from "@payloadcms/ui"
import { notFound } from "next/navigation"
import type { Payload } from "payload"

import { isAdmin } from "@/access/roles"
import type { User } from "@/payload-types"

import { loadPlugins } from "./load"
import { PluginsTable } from "./PluginsTable"

/**
 * System → Plugins: the whole page, in place of the global's edit view, since there is nothing
 * to edit or save. Payload already 404s the hidden global for everyone but admins.
 */
export async function PluginsView({
  payload,
  user,
}: {
  payload: Pick<Payload, "config">
  user?: User | null
}): Promise<React.ReactNode> {
  if (!isAdmin(user)) notFound()
  return (
    <Gutter>
      {/* The edit view would set this breadcrumb; this page replaces it. */}
      <SetStepNav nav={[{ label: "Plugins" }]} />
      <PluginsTable plugins={await loadPlugins(payload.config, user)} />
    </Gutter>
  )
}
