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

type AnchorGenerator = (node: SerializedLexicalNode, counts: Map<string, number>) => string

function headingAnchorGenerator(slugify: SlugifyFn = slugifyHeading): AnchorGenerator {
  return (node, counts) => {
    const text = extractText((node as WithChildren).children)
    const base = slugify(text) || "heading"
    const n = (counts.get(base) ?? 0) + 1
    counts.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }
}

const tableAnchorGenerator: AnchorGenerator = (_, counts) => {
  const n = (counts.get("table") ?? 0) + 1
  counts.set("table", n)
  return `table-${n}`
}

export function stampAnchors<T extends SerializedEditorState>(
  state: T,
  slugify: SlugifyFn = slugifyHeading,
): T {
  const stamped = structuredClone(state)
  const generators: Record<string, AnchorGenerator> = {
    heading: headingAnchorGenerator(slugify),
    table: tableAnchorGenerator,
  }
  const counts = new Map<string, number>()
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    if (!nodes) return
    for (const node of nodes) {
      const generate = generators[node.type]
      if (generate) (node as AnchoredNode).anchor = generate(node, counts)
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
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    if (!nodes) return
    for (const node of nodes) {
      const key = resolverKeyFor(node)
      const resolver = key ? mergedResolvers[key] : undefined
      if (resolver) {
        const entry = resolver(resolverPayloadFor(node))
        if (entry) entries.push(entry)
      }
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
