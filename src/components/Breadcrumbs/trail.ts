/**
 * One step of a breadcrumb trail, after Home. The same shape `buildBreadcrumbJsonLd` takes, so
 * a page builds its trail once and hands it to both: what readers see and what search engines
 * read can't disagree.
 */
export interface Crumb {
  name: string
  path: string
}

/** An entry of the `breadcrumbs` field Payload's nested-docs plugin keeps on each document. */
interface NestedDocsBreadcrumb {
  label?: string | null
  url?: string | null
}

/**
 * The trail for a nested document, from the `breadcrumbs` field the nested-docs plugin keeps up
 * to date: the document's ancestors, root first, then the document itself, each with the label
 * and URL the plugin generated. The plugin re-saves the descendants of a document that changes,
 * so the labels are the current titles, never derived from slugs.
 *
 * `basePath` prefixes each URL when the collection lives under one (`/topics` for a topic at
 * `/topics/parent/child`); the plugin's URLs don't include it. Entries without a label or URL
 * (a parent saved before the plugin was added) are left out rather than shown as blanks.
 */
export function nestedDocsTrail(
  breadcrumbs: NestedDocsBreadcrumb[] | null | undefined,
  basePath = "",
): Crumb[] {
  return (breadcrumbs ?? []).flatMap(({ label, url }) =>
    label && url ? [{ name: label, path: `${basePath}${url}` }] : [],
  )
}
