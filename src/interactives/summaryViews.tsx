import type React from "react"

import { FEDERAL_COURTS_PROFILE_ID } from "./federal-courts"
import type { FederalCourtsSummary } from "./federal-courts/summary"
import { FederalCourtsSummaryView } from "./federal-courts/SummaryView"

// Each profile's landing view, by profile id, for what its `summary.compose` returns. Kept
// apart from the profiles so only the interactive page imports these client views: see
// `InteractiveProfile.summary`.
const SUMMARY_VIEWS: Record<string, (composed: unknown) => React.ReactNode> = {
  // The one cast per profile, so nothing outside it has to know the shape.
  [FEDERAL_COURTS_PROFILE_ID]: (composed) => (
    <FederalCourtsSummaryView data={composed as FederalCourtsSummary} />
  ),
}

/** The landing view for a profile's composed summary, or nothing when it has none. */
export function renderSummary(profileId: string, composed: unknown): React.ReactNode {
  if (composed == null) return null
  return SUMMARY_VIEWS[profileId]?.(composed) ?? null
}
