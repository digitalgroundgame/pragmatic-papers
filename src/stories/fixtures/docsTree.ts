/**
 * The areas and sections a site's docs start with (`src/docs/writing/` and `src/docs/editing/`),
 * as published docs: each area, then its sections, ids from 1, in the order a deploy seeds them.
 */
const PARENTS = [
  { slug: "writing", title: "Writing", parent: null },
  { slug: "getting-started", title: "Getting started", parent: "writing" },
  { slug: "articles", title: "Articles", parent: "writing" },
  { slug: "blocks", title: "Blocks", parent: "writing" },
  { slug: "media", title: "Media", parent: "writing" },
  { slug: "editing", title: "Editing", parent: null },
  { slug: "pages-and-volumes", title: "Pages and volumes", parent: "editing" },
  { slug: "moderation", title: "Moderation", parent: "editing" },
  { slug: "site-settings", title: "Site settings", parent: "editing" },
]

/** An `_order` key for the nth doc: fixed width, so they sort as strings do. */
export const docOrder = (n: number): string => `a${String(n).padStart(3, "0")}`

export const docTreeParents = PARENTS.map((node, i) => ({
  id: i + 1,
  slug: node.slug,
  title: node.title,
  summary: `The docs on ${node.title.toLowerCase()}.`,
  publishedAt: "2026-10-25T00:00:00.000Z",
  parent: node.parent ? PARENTS.findIndex((other) => other.slug === node.parent) + 1 : null,
  _order: docOrder(i),
}))

/** The id of the starter area or section with this slug. */
export const docParentId = (slug: string): number => {
  const node = docTreeParents.find((known) => known.slug === slug)
  if (!node) throw new Error(`No starter area or section is called "${slug}"`)
  return node.id
}
