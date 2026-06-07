import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { TableOfContents, TableOfContentsButton } from "./client"
import {
  type CreateTableOfContentsConverter,
  createTableOfContentsConverter,
} from "./createTableOfContentsConverter"
import { type TableOfContentsField, tableOfContentsField } from "./field"
import { TableOfContentsProvider, type TableOfContentsProviderProps } from "./provider"
import { slugifyHeading } from "./slug"
import type {
  CreateTableOfContentsOptions,
  SlugifyFn,
  TableOfContentsEntry,
  TableOfContentsResolver,
  TableOfContentsResolverMap,
} from "./types"

export type {
  CreateTableOfContentsOptions,
  SlugifyFn,
  TableOfContentsEntry,
  TableOfContentsResolver,
  TableOfContentsResolverMap,
}

interface CreateTableOfContents {
  introAnchor: string
  tableOfContentsField: TableOfContentsField
  TableOfContentsProvider: (
    props: Omit<TableOfContentsProviderProps, "resolvers" | "slugify" | "introAnchor">,
  ) => React.ReactNode
  TableOfContents: typeof TableOfContents
  TableOfContentsButton: typeof TableOfContentsButton
  tableOfContentsConverter: (data?: DefaultTypedEditorState) => CreateTableOfContentsConverter
}

export function createTableOfContents({
  resolvers,
  slugify = slugifyHeading,
  icon,
  introAnchor = "intro",
}: CreateTableOfContentsOptions = {}): CreateTableOfContents {
  return {
    introAnchor,
    tableOfContentsField,
    TableOfContentsProvider: (props) => (
      <TableOfContentsProvider
        {...props}
        resolvers={resolvers}
        slugify={slugify}
        introAnchor={introAnchor}
      />
    ),
    TableOfContents,
    TableOfContentsButton,
    tableOfContentsConverter: (data) => createTableOfContentsConverter(data, slugify, icon),
  }
}
