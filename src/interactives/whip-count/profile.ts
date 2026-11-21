/**
 * The profile id an `interactives` document picks to be a whip count. Unlike a drilldown
 * profile it carries no geometry and no feed adapter: the count is one JSON document in the
 * interactive's snapshot, kept current by pushes (`POST /next/whip-counts/<slug>`) and by
 * editors in the snapshot's table. Dependency-free so the collection config can import it.
 */
export const WHIP_COUNT_PROFILE_ID = "whip-count"

export const WHIP_COUNT_PROFILE_LABEL = "Whip count — a leadership vote tracked voter by voter"
