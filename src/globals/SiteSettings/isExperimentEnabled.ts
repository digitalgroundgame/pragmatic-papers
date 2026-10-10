import type { SiteSetting } from "@/payload-types"
import { getGlobal } from "@/data/globals"

export type Experiment = keyof NonNullable<SiteSetting["experiments"]>

/**
 * Whether a beta feature is switched on in this environment's Settings global.
 * Gate every entry point of an experiment (routes, header links, sitemaps,
 * jobs) with it; routes should `notFound()` when it's off.
 */
export const isExperimentEnabled = async (experiment: Experiment): Promise<boolean> => {
  const settings = await getGlobal("site-settings")
  return settings.experiments?.[experiment] === true
}
