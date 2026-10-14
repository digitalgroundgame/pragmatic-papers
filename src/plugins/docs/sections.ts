/**
 * The docs' main areas, in the sidebar's order, by what the reader is doing: reading the site,
 * writing for it, editing it (pages, volumes, site settings and comments), and building it (which
 * the GitHub wiki holds for now). Admin-only docs sit in whichever of these they're about. An area
 * with no docs yet is left out of the sidebar.
 */
export const DOC_AREAS = [
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "editing", label: "Editing" },
  { value: "development", label: "Development" },
] as const

export type DocArea = (typeof DOC_AREAS)[number]["value"]

/**
 * The sidebar's sections at /docs, in order, each in an area. Every doc sits in one, and its
 * value is both the doc's folder (`src/docs/<value>/`) and what the doc stores, so the label
 * reads as the value does.
 */
export const DOC_SECTIONS = [
  { value: "getting-started", label: "Getting started", area: "writing" },
  { value: "articles", label: "Articles", area: "writing" },
  { value: "blocks", label: "Blocks", area: "writing" },
  { value: "media", label: "Media", area: "writing" },
  { value: "pages-and-volumes", label: "Pages and volumes", area: "editing" },
  { value: "moderation", label: "Moderation", area: "editing" },
  { value: "site-settings", label: "Site settings", area: "editing" },
] as const satisfies readonly { value: string; label: string; area: DocArea }[]

/**
 * The docs' home page, shown at /docs rather than in a section: what the project is and how
 * the docs are laid out. Its file is `src/docs/home.md`.
 */
export const HOME_DOC_SLUG = "home"

export type DocSection = (typeof DOC_SECTIONS)[number]["value"]

export const DEFAULT_DOC_SECTION: DocSection = "getting-started"

export interface DocsSection<T> {
  value: DocSection
  label: string
  area: DocArea
  docs: T[]
}

/** The name the sidebar shows for a doc: its short sidebar title, or its title. */
export const docNavTitle = (doc: { navTitle?: string | null; title: string }): string =>
  doc.navTitle || doc.title

/**
 * Docs under their sections, in the sidebar's order and by sidebar name within each; empty
 * sections are left out, and so is the home doc, which the sidebar links on its own.
 */
export const groupDocsBySection = <
  T extends {
    slug?: string | null
    section?: string | null
    title: string
    navTitle?: string | null
  },
>(
  docs: T[],
): DocsSection<T>[] =>
  DOC_SECTIONS.map(({ value, label, area }) => ({
    value,
    label,
    area,
    docs: docs
      .filter((doc) => doc.slug !== HOME_DOC_SLUG)
      .filter((doc) => (doc.section ?? DEFAULT_DOC_SECTION) === value)
      .sort((a, b) => docNavTitle(a).localeCompare(docNavTitle(b))),
  })).filter((section) => section.docs.length > 0)

/** Sections under their areas, in the sidebar's order; areas with no sections are left out. */
export const groupSectionsByArea = <T>(
  sections: DocsSection<T>[],
): { value: DocArea; label: string; sections: DocsSection<T>[] }[] =>
  DOC_AREAS.map(({ value, label }) => ({
    value,
    label,
    sections: sections.filter((section) => section.area === value),
  })).filter((area) => area.sections.length > 0)

/**
 * The docs before and after one in the sidebar's order, across sections and areas, for a doc's
 * footer. The home doc, when given, comes first, as it heads the sidebar.
 */
export const adjacentDocs = <T extends { slug?: string | null }>(
  sections: DocsSection<T>[],
  slug: string,
  home?: T,
): { previous?: T; next?: T } => {
  const docs = [...(home ? [home] : []), ...sections.flatMap((section) => section.docs)]
  const index = docs.findIndex((doc) => doc.slug === slug)
  if (index < 0) return {}
  return { previous: docs[index - 1], next: docs[index + 1] }
}

/** Where a doc is read: /docs for the home doc, /docs/<slug> for the rest. */
export const docPath = (slug: string): string =>
  slug === HOME_DOC_SLUG ? "/docs" : `/docs/${slug}`

/** Every doc, newest first: the sidebar links it under Home, and the bell's "See all" opens it. */
export const WHATS_NEW_PATH = "/docs/whats-new"
