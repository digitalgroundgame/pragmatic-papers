import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import type { ComponentType, ReactNode, SVGProps } from "react"

export interface TableOfContentsEntry {
  label: string
  anchor: string
  depth?: number
  icon?: ReactNode
  children?: TableOfContentsEntry[]
}

export type TableOfContentsResolver<T = unknown> = (node: T) => TableOfContentsEntry | null

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
}
