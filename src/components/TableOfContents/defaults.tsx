import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import { TableIcon } from "lucide-react"

import { headingTocLabel } from "./label"
import { extractText } from "./traverse"
import type { AnchoredNode, TableOfContentsResolverMap } from "./types"

type HeadingLike = AnchoredNode<SerializedLexicalNode> & {
  tag?: string
  children?: SerializedLexicalNode[]
}

const HEADING_DEPTH: Record<string, number> = { h1: 1, h2: 1, h3: 2, h4: 3, h5: 4, h6: 5 }

export const defaultResolvers: TableOfContentsResolverMap = {
  heading: (node) => {
    const heading = node as HeadingLike
    const text = extractText(heading.children).trim()
    if (!text || !heading.anchor) return null
    const depth = HEADING_DEPTH[heading.tag ?? "h2"] ?? 1
    return { label: headingTocLabel(heading) ?? text, anchor: heading.anchor, depth }
  },
  table: (node) => {
    const { anchor } = node as AnchoredNode
    if (!anchor) return null
    return {
      label: "Table",
      anchor,
      icon: <TableIcon aria-hidden="true" className="text-muted-foreground size-3 shrink-0" />,
    }
  },
}
