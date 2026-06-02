import type { ComponentType, SVGProps } from "react"

export interface TocEntry {
  label: string
  anchor: string
  depth?: number
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

export type TocResolver<T = unknown> = (node: T) => TocEntry | null

export interface TocResolverMap {
  [nodeOrBlockType: string]: TocResolver
}

export type SlugifyFn = (text: string) => string

export interface CreateTableOfContentsOptions {
  resolvers?: TocResolverMap
  slugify?: SlugifyFn
}
