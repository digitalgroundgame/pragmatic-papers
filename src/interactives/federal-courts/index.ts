import React from "react"

import type { InteractiveProfile } from "../types"
import { courtTrackerFeed } from "./feed"
import { loadFederalCourtsGeometry } from "./geometry"
import { federalCourtsMetaLine } from "./meta"
import { federalCourtsPresentation } from "./presentation"
import { composeFederalCourtsSummary, type FederalCourtsSummary } from "./summary"
import { FederalCourtsSummaryView } from "./Summary"
import type { CourtTrackerSources } from "./upstream"

export const FEDERAL_COURTS_PROFILE_ID = "federal-courts"

export const federalCourtsProfile: InteractiveProfile<CourtTrackerSources> = {
  id: FEDERAL_COURTS_PROFILE_ID,
  label: "Federal Courts — circuits, districts and judges (court-tracker)",
  presentation: federalCourtsPresentation,
  loadGeometry: loadFederalCourtsGeometry,
  feed: courtTrackerFeed,
  metaLine: federalCourtsMetaLine,
  summary: {
    compose: composeFederalCourtsSummary,
    // The one cast in the profile, so nothing outside it has to know this shape.
    render: (composed) =>
      React.createElement(FederalCourtsSummaryView, { data: composed as FederalCourtsSummary }),
  },
}
