/** One row per signed-in reader per article they read. */
export const READS_SLUG = "articles-read"

/** The group on each user that holds their visits and streaks. */
export const VISITS_FIELD = "reading"

/**
 * Where the page reports a visit or a read, under Payload's API route: `POST /api/reading`.
 * Kept plain, since blockers drop requests to paths that look like tracking.
 */
export const READING_PATH = "/reading"

/** Where the account page reads the signed-in reader's totals: `GET /api/reading/mine`. */
export const MINE_PATH = "/reading/mine"
