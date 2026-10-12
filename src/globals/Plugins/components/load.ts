import type { SanitizedConfig } from "payload"

import type { User } from "@/payload-types"

import { installedPlugins } from "../trackPlugins"

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
  /** `beta` while an experiment in Settings switches it, `stable` once that's gone. */
  stage: "beta" | "stable"
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
  enabled: boolean | (() => Promise<boolean>) | undefined,
): Promise<PluginRow["status"]> {
  if (enabled === undefined) return "on"
  try {
    return (typeof enabled === "function" ? await enabled() : enabled) ? "on" : "off"
  } catch {
    return "unknown"
  }
}

/**
 * The installed plugins as System → Plugins lists them, in the order Payload runs them: each
 * one's switch read now, and the collections and globals it added linked beside its settings
 * pages, unless the admin hides them from `user`.
 */
export async function loadPlugins(
  config: Pick<SanitizedConfig, "collections" | "custom" | "globals" | "routes">,
  user: User | null | undefined,
): Promise<PluginRow[]> {
  const admin = config.routes.admin === "/" ? "" : config.routes.admin
  return Promise.all(
    installedPlugins(config).map(async (plugin) => {
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
      const settings = (plugin.settings ?? []).map((link) => ({
        label: link.label,
        href: `${admin}${link.path}`,
      }))
      return {
        name: plugin.name,
        source: plugin.source,
        description: plugin.description,
        status: await status(plugin.enabled),
        stage: plugin.beta ? "beta" : "stable",
        pages: [...collections, ...globals, ...settings],
      } satisfies PluginRow
    }),
  )
}
