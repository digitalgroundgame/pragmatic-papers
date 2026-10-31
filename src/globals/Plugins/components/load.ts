import type { Payload } from "payload"

import type { User } from "@/payload-types"
import { SWITCHES_GROUP } from "../pluginSwitches"

import { isPluginOn, type RegisteredPlugin, registeredPlugins } from "@/utilities/registerPlugin"

/** A link to an admin page, or `href: null` when that page is hidden from this user. */
export interface PluginPage {
  label: string
  href: string | null
}

export interface PluginRow {
  name: string
  source: string
  description: string
  /** `unknown` when its switch couldn't be read. */
  status: "on" | "off" | "unknown"
  /** Its switch starts off: it's still being tried out. */
  beta: boolean
  /**
   * Where its switch sits in the Plugins global's form, or `null` when it has none (always on,
   * or switched off in code).
   */
  switchPath: string | null
  pages: PluginPage[]
}

type Hidden = boolean | ((args: { user: never }) => boolean) | undefined
type Label = unknown

/** A collection or global's label in English: a string, a translations object, or the slug. */
function labelText(label: Label, slug: string): string {
  if (typeof label === "string") return label
  if (label && typeof label === "object") {
    const translations = label as Record<string, unknown>
    const text = translations.en ?? Object.values(translations)[0]
    if (typeof text === "string") return text
  }
  return slug
}

function isHidden(hidden: Hidden, user: User | null | undefined): boolean {
  if (typeof hidden === "function") return hidden({ user: user as never })
  return hidden === true
}

async function status(
  enabled: RegisteredPlugin["enabled"],
  payload: Pick<Payload, "config">,
): Promise<PluginRow["status"]> {
  try {
    return (await isPluginOn(enabled, payload as Payload)) ? "on" : "off"
  } catch {
    return "unknown"
  }
}

/**
 * The plugins that registered themselves, as System → Plugins lists them, in the order Payload
 * runs them: each one's switch read now, and the collections and globals it added linked,
 * unless the admin hides them from `user`. A plugin whose switch starts off is a beta.
 */
export async function loadPlugins(
  payload: Pick<Payload, "config">,
  user: User | null | undefined,
): Promise<PluginRow[]> {
  const { config } = payload
  const admin = config.routes.admin === "/" ? "" : config.routes.admin
  return Promise.all(
    registeredPlugins(config).map(async (plugin) => {
      const collections = plugin.collections.flatMap((slug) => {
        const collection = config.collections.find((c) => c.slug === slug)
        if (!collection) return []
        return [
          {
            label: labelText(collection.labels?.plural, slug),
            href: isHidden(collection.admin?.hidden as Hidden, user)
              ? null
              : `${admin}/collections/${slug}`,
          },
        ]
      })
      const globals = plugin.globals.flatMap((slug) => {
        const global = config.globals.find((g) => g.slug === slug)
        if (!global) return []
        return [
          {
            label: labelText(global.label, slug),
            href: isHidden(global.admin?.hidden as Hidden, user)
              ? null
              : `${admin}/globals/${slug}`,
          },
        ]
      })
      return {
        name: plugin.name,
        source: plugin.source,
        description: plugin.description,
        status: await status(plugin.enabled, payload),
        beta: plugin.switch?.defaultValue === false,
        switchPath:
          plugin.switch && plugin.enabled !== false ? `${SWITCHES_GROUP}.${plugin.slug}` : null,
        pages: [...collections, ...globals],
      } satisfies PluginRow
    }),
  )
}
