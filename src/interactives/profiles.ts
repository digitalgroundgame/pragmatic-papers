import { federalCourtsProfile } from "./federal-courts"
import type { InteractiveProfile } from "./types"

/**
 * Every interactive profile the site knows, by id. An `interactives` document selects one of
 * these; adding an interactive means adding a profile here and a document in the admin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous Raw types
const PROFILES: Record<string, InteractiveProfile<any>> = {
  [federalCourtsProfile.id]: federalCourtsProfile,
}

export function getProfile(id: string | null | undefined): InteractiveProfile | null {
  return id ? (PROFILES[id] ?? null) : null
}

export function profileOptions(): { label: string; value: string }[] {
  return Object.values(PROFILES).map((p) => ({ label: p.label, value: p.id }))
}
