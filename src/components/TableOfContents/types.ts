import type { ComponentType, SVGProps } from "react"

export interface TableOfContentsEntry {
  label: string
  anchor: string
  depth?: number
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

export type TocResolver<T = unknown> = (node: T) => TableOfContentsEntry | null

export interface TableOfContentsResolverMap {
  [nodeOrBlockType: string]: TocResolver
}

export type SlugifyFn = (text: string) => string

export interface CreateTableOfContentsOptions {
  resolvers?: TableOfContentsResolverMap
  slugify?: SlugifyFn
}
