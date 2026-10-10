/** The sidebar's sections at /docs, in order. Every doc sits in one. */
export const DOC_SECTIONS = [
  { value: "getting-started", label: "Getting started" },
  { value: "writing", label: "Writing articles" },
  { value: "blocks", label: "Blocks" },
  { value: "media", label: "Photos and media" },
  { value: "site", label: "Pages and the site" },
] as const

export type DocSection = (typeof DOC_SECTIONS)[number]["value"]

export const DEFAULT_DOC_SECTION: DocSection = "getting-started"

export interface DocsSection<T> {
  value: DocSection
  label: string
  docs: T[]
}

/** Docs under their sections, in the sidebar's order and by title within each; empty sections are left out. */
export const groupDocsBySection = <T extends { section?: string | null; title: string }>(
  docs: T[],
): DocsSection<T>[] =>
  DOC_SECTIONS.map(({ value, label }) => ({
    value,
    label,
    docs: docs
      .filter((doc) => (doc.section ?? DEFAULT_DOC_SECTION) === value)
      .sort((a, b) => a.title.localeCompare(b.title)),
  })).filter((section) => section.docs.length > 0)
