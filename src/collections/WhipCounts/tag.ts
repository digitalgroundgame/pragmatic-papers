/**
 * The path of one whip count. Dependency-free and in its own module so the page can import
 * it without dragging the collection config into a route bundle.
 */
export const whipCountPath = (slug: string): string => `/interactives/whip-counts/${slug}`
