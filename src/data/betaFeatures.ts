import type { Config, Field } from "payload"

import type { PluginSwitchName } from "@/globals/Plugins/isPluginEnabled"
import type { Experiment } from "@/globals/SiteSettings/isExperimentEnabled"
import { getPayloadClient } from "@/data/payload"
import { type BetaNote, isBeta, registeredPlugins } from "@/utilities/registerPlugin"

/** A plugin (by its slug) or an experiment (by its field name) that can be a beta. */
export type BetaFeature = PluginSwitchName | Experiment

/** Each beta feature, with what its flask's tooltip says. */
export type BetaFeatures = Partial<Record<BetaFeature, string>>

export const DEFAULT_BETA_INFO = "In beta: we're still trying this out, so it may change."

const info = (note: BetaNote): string => note.info ?? DEFAULT_BETA_INFO

/** The experiments in the Settings global whose field carries a `beta` note. */
function betaExperiments(config: Pick<Config, "globals">): [string, BetaNote][] {
  const settings = config.globals?.find((global) => global.slug === "site-settings")
  const group = settings?.fields.find(
    (field): field is Extract<Field, { type: "group" }> =>
      field.type === "group" && "name" in field && field.name === "experiments",
  )
  return (group?.fields ?? []).flatMap((field): [string, BetaNote][] => {
    const beta = (field.custom as { beta?: BetaNote } | undefined)?.beta
    return "name" in field && beta ? [[field.name, beta]] : []
  })
}

/**
 * Every feature still in beta, from the config alone: plugins whose manifest says `beta`, and
 * experiments whose field does. Nothing here reads the database, so a page that shows a flask
 * caches like any other.
 */
export function betaFeaturesOf(config: Pick<Config, "custom" | "globals">): BetaFeatures {
  const plugins = registeredPlugins(config)
    .filter(isBeta)
    .map((plugin) => [plugin.slug, info(plugin.beta ?? {})] as const)
  const experiments = betaExperiments(config).map(([name, note]) => [name, info(note)] as const)
  return Object.fromEntries([...experiments, ...plugins]) as BetaFeatures
}

/** The beta features of this site's config, for a layout to hand its pages. */
export async function getBetaFeatures(): Promise<BetaFeatures> {
  const payload = await getPayloadClient()
  return betaFeaturesOf(payload.config)
}
