import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import { TableIcon } from "lucide-react"

import { extractText } from "./traverse"
import type { TableOfContentsResolverMap } from "./types"

type HeadingLike = SerializedLexicalNode & {
  tag?: string
  children?: SerializedLexicalNode[]
}

const HEADING_DEPTH: Record<string, number> = { h1: 1, h2: 1, h3: 2, h4: 3, h5: 4, h6: 5 }

export function buildDefaultResolvers(
  anchors: Map<SerializedLexicalNode, string>,
): TableOfContentsResolverMap {
  return {
    heading: (node) => {
      const heading = node as HeadingLike
      const label = extractText(heading.children).trim()
      if (!label) return null
      const anchor = anchors.get(heading)
      if (!anchor) return null
      const depth = HEADING_DEPTH[heading.tag ?? "h2"] ?? 1
      return { label, anchor, depth }
    },
    table: (node) => {
      interface TableRow {
        children?: Array<{
          children?: Array<{ type?: string; text?: string; children?: unknown[] }>
        }>
      }
      const firstRow = (node as TableRow).children?.[0]
      const firstCell = firstRow?.children?.[0]
      const cellText = extractText(firstCell?.children as Parameters<typeof extractText>[0]).trim()
      return {
        label: cellText || "Table",
        anchor: anchors.get(node as SerializedLexicalNode) ?? "",
        depth: 1,
        icon: TableIcon,
      }
    },
  }
}
