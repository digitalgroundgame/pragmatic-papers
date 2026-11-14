import { federalCourtsProfile } from "./federal-courts"
import type { InteractiveProfile } from "./types"
import { WHIP_COUNT_PROFILE_ID, WHIP_COUNT_PROFILE_LABEL } from "./whip-count/profile"

/**
 * Every drilldown profile the site knows, by id: an overview map with geometry, presentation
 * and a feed adapter. An `interactives` document selects one of these, or one of the other
 * kinds below; adding an interactive means adding a profile here and a document in the admin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous Raw types
const PROFILES: Record<string, InteractiveProfile<any>> = {
  [federalCourtsProfile.id]: federalCourtsProfile,
}

/**
 * What an interactive is, which decides how its page draws its snapshot: a `drilldown` map
 * (the profiles above), or a `whip-count`, whose snapshot holds a whip count instead
 * (`src/interactives/whip-count`).
 */
export type ProfileKind = "drilldown" | "whip-count"

const OTHER_PROFILES: Record<string, { kind: Exclude<ProfileKind, "drilldown">; label: string }> = {
  [WHIP_COUNT_PROFILE_ID]: { kind: "whip-count", label: WHIP_COUNT_PROFILE_LABEL },
}

/** The drilldown profile at an id, or null for an unknown id or another kind. */
export function getProfile(id: string | null | undefined): InteractiveProfile | null {
  return id ? (PROFILES[id] ?? null) : null
}

/** Which kind of interactive a profile id draws, or null for an unknown id. */
export function profileKind(id: string | null | undefined): ProfileKind | null {
  if (!id) return null
  if (PROFILES[id]) return "drilldown"
  return OTHER_PROFILES[id]?.kind ?? null
}

export function profileOptions(): { label: string; value: string }[] {
  return [
    ...Object.values(PROFILES).map((p) => ({ label: p.label, value: p.id })),
    ...Object.entries(OTHER_PROFILES).map(([value, p]) => ({ label: p.label, value })),
  ]
}
