/**
 * Values shared between the e2e seed and the specs that rely on it.
 *
 * Deliberately dependency-free: `scripts/seed-e2e.ts` pulls in Payload and the
 * whole app config, which a Playwright spec has no business importing just to
 * learn a slug.
 */

/** The four-author article, seeded to exercise the collapsed byline. */
export const FOUR_AUTHOR_SLUG = "committee-work-notes-from-a-crowded-byline"

/**
 * Length of the silent WAV the seed attaches to that article as narration. The
 * player prints it ("Listen · 0:03"), so a baseline depends on it.
 */
export const NARRATION_SECONDS = 3

/**
 * The revision stamp the seed pins onto every article and volume it creates.
 * Payload stamps `updatedAt` with the current time on every non-draft save,
 * which would otherwise put the day the seed ran into each hero's dateline —
 * and into every baseline that frames one. Pinning only the narrated article
 * left the share-button baselines reading the seed date, so they rotted the
 * first time a run rebuilt the page instead of serving a cached prerender.
 */
export const SEEDED_UPDATED_AT = "2026-06-11T16:30:00.000Z"

/**
 * What a hero prints for its two instants, in the publication's timezone
 * (America/New_York). Asserted wherever a spec frames a dateline: if either
 * date ever goes back to tracking the clock, the spec fails loudly instead of
 * the baseline quietly rotting.
 */
export const SEEDED_DATELINE = "June 3, 2026"
export const SEEDED_REVISION = "Updated June 11, 2026"
