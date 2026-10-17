/**
 * The docs' home page, shown at /docs rather than in a section: what the project is and how
 * the docs are laid out. Its file is `src/docs/home.md`.
 */
export const HOME_DOC_SLUG = "home"

/**
 * A row of the Doc sections collection, in the sidebar's order (`_order`). One with no parent
 * is an area (Writing, Editing); one whose parent is an area is a section of it (Articles).
 */
export interface DocSectionNode {
  id: number | string
  title: string
  slug?: string | null
  parent?: number | string | { id: number | string } | null
}

export interface DocsSection<T> {
  /** The section's slug, or its id when it has none: unique in the sidebar. */
  key: string
  title: string
  docs: T[]
}

export interface DocsArea<T> {
  key: string
  title: string
  sections: DocsSection<T>[]
}

/** Where the sidebar lists docs with no section, or one it can't place, so none is lost. */
export const UNSORTED_AREA = { key: "other", title: "Other" } as const
export const UNSORTED_SECTION = { key: "unsorted", title: "Unsorted" } as const

/** The name the sidebar shows for a doc: its short sidebar title, or its title. */
export const docNavTitle = (doc: { navTitle?: string | null; title: string }): string =>
  doc.navTitle || doc.title

const idOf = (value: DocSectionNode["parent"]): string | null =>
  value === null || value === undefined
    ? null
    : String(typeof value === "object" ? value.id : value)

const keyOf = (node: DocSectionNode): string => node.slug || String(node.id)

/**
 * Docs under their areas and sections, in the order editors gave the sections and by sidebar
 * name within each. Empty sections and areas are left out, and so is the home doc, which the
 * sidebar links on its own. A doc with no section, or one filed under an area or a section
 * that's gone, goes under Other, last.
 */
export const groupDocs = <
  T extends {
    slug?: string | null
    section?: DocSectionNode["parent"]
    title: string
    navTitle?: string | null
  },
>(
  docs: T[],
  nodes: DocSectionNode[],
): DocsArea<T>[] => {
  const listed = docs.filter((doc) => doc.slug !== HOME_DOC_SLUG)
  const byName = (a: T, b: T) => docNavTitle(a).localeCompare(docNavTitle(b))
  const placed = new Set<T>()

  const areas = nodes
    .filter((node) => idOf(node.parent) === null)
    .map((area) => ({
      key: keyOf(area),
      title: area.title,
      sections: nodes
        .filter((node) => idOf(node.parent) === String(area.id))
        .map((section) => {
          const sectionDocs = listed.filter((doc) => idOf(doc.section) === String(section.id))
          sectionDocs.forEach((doc) => placed.add(doc))
          return { key: keyOf(section), title: section.title, docs: sectionDocs.sort(byName) }
        })
        .filter((section) => section.docs.length > 0),
    }))
    .filter((area) => area.sections.length > 0)

  const unsorted = listed.filter((doc) => !placed.has(doc)).sort(byName)
  if (unsorted.length) {
    areas.push({ ...UNSORTED_AREA, sections: [{ ...UNSORTED_SECTION, docs: unsorted }] })
  }
  return areas
}

/** Every doc the sidebar lists, in its order. */
export const docsInOrder = <T>(areas: DocsArea<T>[]): T[] =>
  areas.flatMap((area) => area.sections.flatMap((section) => section.docs))

/**
 * The docs before and after one in the sidebar's order, across sections and areas, for a doc's
 * footer. The home doc, when given, comes first, as it heads the sidebar.
 */
export const adjacentDocs = <T extends { slug?: string | null }>(
  areas: DocsArea<T>[],
  slug: string,
  home?: T,
): { previous?: T; next?: T } => {
  const docs = [...(home ? [home] : []), ...docsInOrder(areas)]
  const index = docs.findIndex((doc) => doc.slug === slug)
  if (index < 0) return {}
  return { previous: docs[index - 1], next: docs[index + 1] }
}

/** Where a doc is read: /docs for the home doc, /docs/<slug> for the rest. */
export const docPath = (slug: string): string =>
  slug === HOME_DOC_SLUG ? "/docs" : `/docs/${slug}`

/** Every doc, newest first: the sidebar links it under Home, and the bell's "See all" opens it. */
export const WHATS_NEW_PATH = "/docs/whats-new"
