import { TableIcon } from "lucide-react"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"

import { extractText } from "./traverse"
import type { TocResolverMap } from "./types"

type HeadingLike = SerializedLexicalNode & {
  tag?: string
  children?: SerializedLexicalNode[]
}

type TableLike = SerializedLexicalNode & {
  children?: SerializedLexicalNode[]
  fields?: { id?: string | null }
}

const HEADING_DEPTH: Record<string, number> = { h1: 1, h2: 1, h3: 2, h4: 3, h5: 4, h6: 5 }

export function buildDefaultResolvers(
  headingAnchors: Map<SerializedLexicalNode, string>,
): TocResolverMap {
  return {
    heading: (node) => {
      const heading = node as HeadingLike
      const label = extractText(heading.children).trim()
      if (!label) return null
      const anchor = headingAnchors.get(heading)
      if (!anchor) return null
      const depth = HEADING_DEPTH[heading.tag ?? "h2"] ?? 1
      return { label, anchor, depth }
    },
    table: (node) => {
      const table = node as TableLike
      const firstRow = table.children?.[0] as { children?: SerializedLexicalNode[] } | undefined
      const firstCell = firstRow?.children?.[0] as
        | { children?: SerializedLexicalNode[] }
        | undefined
      const cellText = extractText(firstCell?.children).trim()
      return {
        label: cellText || "Table",
        anchor: "",
        depth: 1,
        icon: TableIcon,
      }
    },
  }
}
