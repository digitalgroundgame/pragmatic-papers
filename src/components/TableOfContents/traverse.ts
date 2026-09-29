import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"

import { defaultResolvers } from "./defaults"
import { slugifyHeading } from "./slug"
import type {
  AnchoredNode,
  SlugifyFn,
  TableOfContentsEntry,
  TableOfContentsResolverMap,
} from "./types"

type WithChildren = SerializedLexicalNode & { children?: SerializedLexicalNode[] }
type WithBlockFields = SerializedLexicalNode & { fields?: { blockType?: string } }
interface AnyNode {
  type?: string
  text?: string
  children?: AnyNode[]
}

export function extractText(nodes: AnyNode[] | undefined): string {
  if (!nodes) return ""
  let out = ""
  for (const node of nodes) {
    if (node.type === "text") {
      out += node.text ?? ""
    } else if (Array.isArray(node.children)) {
      out += extractText(node.children)
    }
  }
  return out
}

function resolverKeyFor(node: SerializedLexicalNode): string {
  if (node.type === "block" || node.type === "inlineBlock") {
    return (node as WithBlockFields).fields?.blockType ?? ""
  }
  return node.type
}

function resolverPayloadFor(node: SerializedLexicalNode): unknown {
  if (node.type === "block" || node.type === "inlineBlock") {
    return (node as { fields?: unknown }).fields
  }
  return node
}

/**
 * Ids handed out so far, plus the ones the page renders itself. Every anchor
 * is claimed here, so no two elements on the page end up sharing an id.
 */
interface AnchorIds {
  counts: Map<string, number>
  taken: (id: string) => boolean
}

type AnchorGenerator = (node: SerializedLexicalNode, ids: AnchorIds) => string | undefined

/** `base`, else `base-2`, `base-3`… the first one that isn't taken. */
function dedupe(base: string, { counts, taken }: AnchorIds): string {
  let n = counts.get(base) ?? 0
  let id: string
  do id = ++n === 1 ? base : `${base}-${n}`
  while (taken(id))
  counts.set(base, n)
  counts.set(id, Math.max(counts.get(id) ?? 0, 1))
  return id
}

function headingAnchorGenerator(slugify: SlugifyFn): AnchorGenerator {
  return (node, ids) => {
    const text = extractText((node as WithChildren).children)
    return dedupe(slugify(text) || "heading", ids)
  }
}

function blockAnchorGenerator(
  resolvers: TableOfContentsResolverMap,
  slugify: SlugifyFn,
): AnchorGenerator {
  return (node, ids) => {
    const entry = resolvers[resolverKeyFor(node)]?.(resolverPayloadFor(node))
    if (!entry || entry.anchor) return undefined
    return dedupe(slugify(entry.label) || "block", ids)
  }
}

/**
 * Tables are numbered table-1, table-2… in their own sequence, skipping any
 * number a heading or block already took (a heading reading "Table 1"), and
 * claiming the id so a later heading can't take it either.
 */
const tableAnchorGenerator: AnchorGenerator = (_, { counts, taken }) => {
  let n = counts.get("table") ?? 0
  let id: string
  do id = `table-${++n}`
  while (taken(id))
  counts.set("table", n)
  counts.set(id, 1)
  return id
}

/**
 * `reserved` ids are ones the page renders itself (the Intro wrapper, say): an
 * id, or a pattern for a numbered family of them. A heading that slugifies to
 * one is suffixed instead of duplicating its id.
 */
export function stampAnchors<T extends SerializedEditorState>(
  state: T,
  slugify: SlugifyFn = slugifyHeading,
  resolvers: TableOfContentsResolverMap = {},
  reserved: (string | RegExp)[] = [],
): T {
  const stamped = structuredClone(state)
  const block = blockAnchorGenerator(resolvers, slugify)
  const generators: Record<string, AnchorGenerator> = {
    heading: headingAnchorGenerator(slugify),
    table: tableAnchorGenerator,
    block,
    inlineBlock: block,
  }
  const counts = new Map<string, number>(
    reserved.filter((id) => typeof id === "string").map((id) => [id, 1]),
  )
  const patterns = reserved.filter((id) => id instanceof RegExp)
  const ids: AnchorIds = {
    counts,
    taken: (id) => counts.has(id) || patterns.some((pattern) => pattern.test(id)),
  }
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    if (!nodes) return
    for (const node of nodes) {
      const generate = generators[node.type]
      if (generate) {
        const anchor = generate(node, ids)
        if (anchor) (node as AnchoredNode).anchor = anchor
        else delete (node as AnchoredNode).anchor
      }
      walk((node as WithChildren).children)
    }
  }
  walk(stamped.root.children as SerializedLexicalNode[])
  return stamped
}

export function nestEntries(flat: TableOfContentsEntry[]): TableOfContentsEntry[] {
  const root: TableOfContentsEntry[] = []
  const stack: Array<{ entry: TableOfContentsEntry; depth: number }> = []

  for (const orig of flat) {
    const entry: TableOfContentsEntry = { ...orig }
    const depth = entry.depth ?? 1
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop()
    }
    if (stack.length === 0) {
      root.push(entry)
    } else {
      const parent = stack[stack.length - 1]!.entry
      parent.children ??= []
      parent.children.push(entry)
    }
    stack.push({ entry, depth })
  }

  return root
}

export function collectEntries(
  content: SerializedEditorState,
  resolvers: TableOfContentsResolverMap = {},
): TableOfContentsEntry[] {
  const mergedResolvers: TableOfContentsResolverMap = { ...defaultResolvers, ...resolvers }
  const entries: TableOfContentsEntry[] = []
  let sectionDepth = 0
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    if (!nodes) return
    // The entry of the heading this node directly follows, if any.
    let headingJustBefore: TableOfContentsEntry | undefined
    for (const node of nodes) {
      const key = resolverKeyFor(node)
      const resolver = key ? mergedResolvers[key] : undefined
      let headingEntry: TableOfContentsEntry | undefined
      if (resolver) {
        const entry = resolver(resolverPayloadFor(node))
        const anchor = entry?.anchor ?? (node as AnchoredNode).anchor
        if (entry && anchor !== undefined) {
          if (node.type === "table" && headingJustBefore) {
            // A table right under a heading is that heading's table: the heading's
            // entry takes the table's icon instead of listing the table again.
            headingJustBefore.icon ??= entry.icon
          } else {
            // Headings open a section; anything else without a depth nests inside it.
            const depth = entry.depth ?? (node.type === "heading" ? 1 : sectionDepth + 1)
            if (node.type === "heading") sectionDepth = depth
            const pushed = { ...entry, anchor, depth }
            entries.push(pushed)
            if (node.type === "heading") headingEntry = pushed
          }
        }
      }
      headingJustBefore = headingEntry
      walk((node as WithChildren).children)
    }
  }
  walk(content.root.children as SerializedLexicalNode[])
  return entries
}

export function buildEntries(
  content: SerializedEditorState,
  resolvers?: TableOfContentsResolverMap,
  anchor = "#",
): TableOfContentsEntry[] {
  const entries = nestEntries(collectEntries(content, resolvers))
  const firstNode = content.root.children[0]
  if (firstNode?.type !== "heading" && entries.length > 0) {
    entries.unshift({ label: "Intro", anchor, depth: 1 })
  }
  return entries
}
