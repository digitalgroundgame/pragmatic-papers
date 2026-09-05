import type { InteractiveProfile } from "../types"
import { courtTrackerFeed } from "./feed"
import { loadFederalCourtsGeometry } from "./geometry"
import { federalCourtsPresentation } from "./presentation"
import type { CourtTrackerSources } from "./upstream"

export const FEDERAL_COURTS_PROFILE_ID = "federal-courts"

export const federalCourtsProfile: InteractiveProfile<CourtTrackerSources> = {
  id: FEDERAL_COURTS_PROFILE_ID,
  label: "Federal Courts — circuits, districts and judges (court-tracker)",
  presentation: federalCourtsPresentation,
  loadGeometry: loadFederalCourtsGeometry,
  feed: courtTrackerFeed,
}
