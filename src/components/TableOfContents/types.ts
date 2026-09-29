import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import type { ComponentType, ReactNode, SVGProps } from "react"

export interface TableOfContentsEntry {
  label: string
  anchor: string
  depth?: number
  icon?: ReactNode
  children?: TableOfContentsEntry[]
}

/** Omitting `anchor` on a block uses the one stamped on save from its label. */
export type TableOfContentsResolvedEntry = Omit<TableOfContentsEntry, "anchor"> & {
  anchor?: string
}

export type TableOfContentsResolver<T = unknown> = (node: T) => TableOfContentsResolvedEntry | null

export interface TableOfContentsResolverMap {
  [nodeOrBlockType: string]: TableOfContentsResolver
}

export type SlugifyFn = (text: string) => string

export type AnchoredNode<T extends SerializedLexicalNode = SerializedLexicalNode> = T & {
  anchor?: string
}

export interface CreateTableOfContentsOptions {
  resolvers?: TableOfContentsResolverMap
  slugify?: SlugifyFn
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  introAnchor?: string
  /**
   * Ids the page already renders beside the article body, which headings and
   * blocks mustn't take: an id, or a pattern for a numbered family of them.
   */
  reservedAnchors?: (string | RegExp)[]
}
