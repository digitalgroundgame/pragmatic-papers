/**
 * Cache tag and path for one interactive. Dependency-free and in its own module for the same
 * reason as `collections/Merch/tag.ts`: the page and the region route reach for these, and
 * importing them must not drag the collection config into a route bundle.
 *
 * Dropped by the sync job when a published snapshot changes, and by the snapshot collection's
 * hooks when an editor publishes or unpublishes one.
 */
export const interactiveTag = (interactiveId: number | string): string =>
  `interactive:${interactiveId}`

export const interactivePath = (slug: string): string => `/interactives/${slug}`
