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

export type AnchorGenerator = (
  node: SerializedLexicalNode,
  state: Map<string, number>,
) => string | null

export function computeAnchors(
  data: SerializedEditorState | undefined,
  generators: Record<string, AnchorGenerator>,
): Map<SerializedLexicalNode, string> {
  const state = new Map<string, number>()
  const result = new Map<SerializedLexicalNode, string>()
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    if (!nodes) return
    for (const node of nodes) {
      const gen = generators[node.type]
      if (gen) {
        const id = gen(node, state)
        if (id) result.set(node, id)
      }
      walk((node as WithChildren).children)
    }
  }
  walk(data?.root.children as SerializedLexicalNode[])
  return result
}

export function headingAnchorGenerator(slugify: SlugifyFn = slugifyHeading): AnchorGenerator {
  return (node, state) => {
    const text = extractText((node as WithChildren).children)
    const base = slugify(text) || "heading"
    const n = (state.get(base) ?? 0) + 1
    state.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }
}

export const tableAnchorGenerator: AnchorGenerator = (_, state) => {
  const n = (state.get("table") ?? 0) + 1
  state.set("table", n)
  return `table-${n}`
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
  slugify?: SlugifyFn,
): TableOfContentsEntry[] {
  const anchors = computeAnchors(content, {
    heading: headingAnchorGenerator(slugify),
    table: tableAnchorGenerator,
  })
  const defaults = buildDefaultResolvers(anchors)
  const mergedResolvers: TableOfContentsResolverMap = { ...defaults, ...resolvers }
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
  slugify?: SlugifyFn,
  anchor = "#",
): TableOfContentsEntry[] {
  const entries = nestEntries(collectEntries(content, resolvers, slugify))
  const firstNode = content.root.children[0]
  if (firstNode?.type !== "heading" && entries.length > 0) {
    entries.unshift({ label: "Intro", anchor, depth: 1 })
  }
  return entries
}
