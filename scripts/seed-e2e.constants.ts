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

/** The rich-text showcase article: the homepage's article tile and volume 1's only article. */
export const SHOWCASE_SLUG = "rich-text-showcase"
export const SHOWCASE_TITLE = "The Written Word: A Survey of Text Formatting"

/** The seeded volume holding the showcase article. */
export const VOLUME_SLUG = "1"

/** The author of every seeded article, and the one whose author card is fully populated. */
export const WRITER_NAME = "Teagan Wordsmith"
export const WRITER_SLUG = "e2e-writer"

/**
 * The topic the seeded feature articles (footnotes, code blocks, media, social
 * embeds) are filed under, so /topics and /topics/[slug] have something to
 * list. Only those articles carry it: the ones other specs photograph stay
 * untouched.
 */
export const TOPIC_NAME = "Research Methods"
export const TOPIC_SLUG = "research-methods"

/** An article with five footnotes, the last a reference to the showcase article. */
export const FOOTNOTES_SLUG = "demonstrating-footnotes-comprehensive-guide"
export const FOOTNOTES_TITLE = "Demonstrating Footnotes: A Comprehensive Guide"

/** An article with three code blocks (TypeScript, JavaScript, CSS). */
export const CODE_BLOCKS_SLUG = "code-blocks-syntax-samples-for-authors"

/** An article with a single media block, which opens in a lightbox. */
export const LIGHTBOX_SLUG = "seeing-the-evidence-a-media-block"
export const LIGHTBOX_IMAGE_ALT = "A printed page on a green desk, shown full screen"

/** The hero and SEO image every seeded article carries: Storybook's landscape fixture. */
export const ARTICLE_IMAGE_ALT = "Mountains at sunset"

/** An article with one social embed per platform, each with a saved snapshot. */
export const SOCIAL_EMBEDS_SLUG = "social-media-embed-test-all-variations"

/**
 * Authors with no articles, seeded so /authors runs past its five-per-page
 * limit. Their names sort after every other seeded author's, so the authors
 * other specs look for stay on page 1.
 */
export const EXTRA_AUTHORS = [
  { name: "Victor Vellum", slug: "e2e-author-victor", email: "victor@e2e.test" },
  { name: "Winona Whitfield", slug: "e2e-author-winona", email: "winona@e2e.test" },
]
