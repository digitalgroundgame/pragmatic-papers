/**
 * Values shared between the e2e seed and the specs that rely on it.
 *
 * Deliberately dependency-free: `scripts/seed-e2e.ts` pulls in Payload and the
 * whole app config, which a Playwright spec has no business importing just to
 * learn a slug.
 */

/** The four-author article, seeded to exercise the collapsed byline. */
export const FOUR_AUTHOR_SLUG = "committee-work-notes-from-a-crowded-byline"
