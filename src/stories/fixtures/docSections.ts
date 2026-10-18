import starter from "@/docs/sections.json"
import type { DocSectionNode } from "@/plugins/docs/sections"

/**
 * The Doc sections a site starts with (`src/docs/sections.json`), as the sidebar's query finds
 * them: areas, each followed by its sections, with ids from 1.
 */
export const docSectionNodes: DocSectionNode[] = starter.areas
  .flatMap((area) => [
    { slug: area.slug, title: area.title },
    ...area.sections.map((section) => ({ ...section, parentSlug: area.slug })),
  ])
  .map((node, i, nodes) => ({
    id: i + 1,
    slug: node.slug,
    title: node.title,
    parent:
      "parentSlug" in node ? nodes.findIndex((other) => other.slug === node.parentSlug) + 1 : null,
  }))

/** The id of the starter section with this slug. */
export const docSectionId = (slug: string): number => {
  const node = docSectionNodes.find((known) => known.slug === slug)
  if (!node) throw new Error(`No starter doc section is called "${slug}"`)
  return node.id as number
}
