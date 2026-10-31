/**
 * How many of a collection's newest documents `generateStaticParams` prebuilds. The rest render
 * on their first request and are cached the same way, so the cap only bounds build time.
 */
export const PRERENDER_LIMIT = 1000
