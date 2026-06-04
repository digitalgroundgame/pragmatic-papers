import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"

import { buildDefaultResolvers } from "./defaults"
import { slugifyHeading } from "./slug"
import type { SlugifyFn, TableOfContentsEntry, TableOfContentsResolverMap } from "./types"

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

export function computeHeadingAnchors(
  data?: SerializedEditorState,
  slugify: SlugifyFn = slugifyHeading,
): Map<SerializedLexicalNode, string> {
  const counts = new Map<string, number>()
  const result = new Map<SerializedLexicalNode, string>()
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    if (!nodes) return
    for (const node of nodes) {
      if (node.type === "heading") {
        const text = extractText((node as WithChildren).children)
        const base = slugify(text) || "heading"
        const n = (counts.get(base) ?? 0) + 1
        counts.set(base, n)
        result.set(node, n === 1 ? base : `${base}-${n}`)
      }
      walk((node as WithChildren).children)
    }
  }
  walk(data?.root.children as SerializedLexicalNode[])
  return result
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
  data: SerializedEditorState,
  callerResolvers: TableOfContentsResolverMap = {},
  slugify: SlugifyFn = slugifyHeading,
): TableOfContentsEntry[] {
  const anchors = computeHeadingAnchors(data, slugify)
  const defaults = buildDefaultResolvers(anchors)
  const resolvers: TableOfContentsResolverMap = { ...defaults, ...callerResolvers }
  const entries: TableOfContentsEntry[] = []
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    if (!nodes) return
    for (const node of nodes) {
      const key = resolverKeyFor(node)
      const resolver = key ? resolvers[key] : undefined
      if (resolver) {
        const entry = resolver(resolverPayloadFor(node))
        if (entry) entries.push(entry)
      }
      walk((node as WithChildren).children)
    }
  }
  walk(data.root.children as SerializedLexicalNode[])
  return entries
}

export function buildEntries(
  data: SerializedEditorState,
  callerResolvers?: TableOfContentsResolverMap,
  slugify?: SlugifyFn,
): TableOfContentsEntry[] {
  return nestEntries(collectEntries(data, callerResolvers, slugify))
}
