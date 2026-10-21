/**
 * The docs' home page, shown at /docs rather than in the tree: what the project is and how the
 * docs are laid out. Its file is `src/docs/home.md`.
 */
export const HOME_DOC_SLUG = "home"

/** Where the docs live; the home doc is read here. */
export const DOCS_PATH = "/docs"

/** Every doc, newest first: the sidebar links it under Home, and the bell's "See all" opens it. */
export const WHATS_NEW_PATH = "/docs/whats-new"

/** A doc's parent as Payload hands it over: its id, the doc itself, or nothing for a top one. */
export type ParentRef = number | string | { id: number | string } | null | undefined

/** What the tree needs of a doc. */
export interface TreeDoc {
  id: number | string
  slug?: string | null
  title: string
  navTitle?: string | null
  parent?: ParentRef
  /** Where editors dragged it among its siblings (the collection is orderable). */
  _order?: string | null
}

/** A doc in the tree, with the address its place in the tree gives it. */
export interface DocsNode<T> {
  doc: T
  /** `/docs/<area>/<section>/<slug>`: each ancestor's slug, then its own. */
  path: string
  children: DocsNode<T>[]
}

/** The name the sidebar shows for a doc: its short sidebar title, or its title. */
export const docNavTitle = (doc: { navTitle?: string | null; title: string }): string =>
  doc.navTitle || doc.title

/**
 * The address of a doc whose ancestors, top first, then itself, have these slugs: the home doc
 * at /docs, every other at `/docs/<slug>/<slug>…`. The nested docs plugin builds breadcrumbs
 * with it too.
 */
export const docURL = (slugs: (string | null | undefined)[]): string => {
  const parts = slugs.filter((slug): slug is string => Boolean(slug))
  if (!parts.length || (parts.length === 1 && parts[0] === HOME_DOC_SLUG)) return DOCS_PATH
  return `${DOCS_PATH}/${parts.join("/")}`
}

const idOf = (value: ParentRef): string | null =>
  value === null || value === undefined
    ? null
    : String(typeof value === "object" ? value.id : value)

/** Editors' drag order (fractional keys, compared as plain strings), then the sidebar name. */
const bySiblingOrder = <T extends TreeDoc>(a: DocsNode<T>, b: DocsNode<T>): number => {
  const [x, y] = [a.doc._order ?? "", b.doc._order ?? ""]
  if (x !== y) return x < y ? -1 : 1
  return docNavTitle(a.doc).localeCompare(docNavTitle(b.doc))
}

/**
 * The published docs as a tree, top docs first, each one's children in the order editors
 * dragged them. A doc whose parent isn't among `docs` (unpublished, or deleted) sits at the top,
 * so none is lost. The home doc is left out: the sidebar links it on its own, at /docs.
 */
export const docsTree = <T extends TreeDoc>(docs: T[]): DocsNode<T>[] => {
  const listed = docs.filter((doc) => doc.slug !== HOME_DOC_SLUG)
  const ids = new Set(listed.map((doc) => String(doc.id)))
  const childrenOf = new Map<string | null, T[]>()
  for (const doc of listed) {
    const parent = idOf(doc.parent)
    const key = parent !== null && ids.has(parent) && parent !== String(doc.id) ? parent : null
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), doc])
  }

  // Walked from the top, so a loop of parents (each other's) is never reached: its docs go to
  // the top level below.
  const placed = new Set<string>()
  const build = (doc: T, ancestors: string[]): DocsNode<T> => {
    placed.add(String(doc.id))
    const slugs = [...ancestors, doc.slug ?? String(doc.id)]
    const children = (childrenOf.get(String(doc.id)) ?? [])
      .filter((child) => !placed.has(String(child.id)))
      .map((child) => build(child, slugs))
      .sort(bySiblingOrder)
    return { doc, path: docURL(slugs), children }
  }
  const roots = (childrenOf.get(null) ?? []).map((doc) => build(doc, []))
  for (const doc of listed) {
    if (!placed.has(String(doc.id))) roots.push(build(doc, []))
  }
  return roots.sort(bySiblingOrder)
}

/** Every doc in the tree, each before its children: the sidebar's reading order. */
export const docsInOrder = <T>(nodes: DocsNode<T>[]): DocsNode<T>[] =>
  nodes.flatMap((node) => [node, ...docsInOrder(node.children)])

/** The doc with this slug, and its ancestors, top first; empty when it isn't in the tree. */
export const docLineage = <T extends { slug?: string | null }>(
  nodes: DocsNode<T>[],
  slug: string,
): DocsNode<T>[] => {
  for (const node of nodes) {
    if (node.doc.slug === slug) return [node]
    const below = docLineage(node.children, slug)
    if (below.length) return [node, ...below]
  }
  return []
}

/**
 * The docs before and after one in the sidebar's order, across sections and areas, for a doc's
 * footer. The home doc, when given, comes first, as it heads the sidebar.
 */
export const adjacentDocs = <T extends TreeDoc>(
  nodes: DocsNode<T>[],
  slug: string,
  home?: T,
): { previous?: T; next?: T } => {
  const docs = [...(home ? [home] : []), ...docsInOrder(nodes).map((node) => node.doc)]
  const index = docs.findIndex((doc) => doc.slug === slug)
  if (index < 0) return {}
  return { previous: docs[index - 1], next: docs[index + 1] }
}

/** Where to read each doc in the tree, by slug, with the home doc at /docs. */
export const docPaths = <T extends TreeDoc>(nodes: DocsNode<T>[]): Map<string, string> =>
  new Map([
    [HOME_DOC_SLUG, DOCS_PATH],
    ...docsInOrder(nodes).flatMap((node) =>
      node.doc.slug ? [[node.doc.slug, node.path] as const] : [],
    ),
  ])

/** The ids of the docs other docs sit under: areas and sections, which introduce their docs. */
export const parentIds = <T extends TreeDoc>(nodes: DocsNode<T>[]): Set<string> =>
  new Set(docsInOrder(nodes).flatMap((node) => (node.children.length ? [String(node.doc.id)] : [])))
