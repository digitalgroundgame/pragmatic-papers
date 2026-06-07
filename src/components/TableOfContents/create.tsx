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
  tableOfContentsField: TableOfContentsField
  TableOfContentsProvider: (
    props: Omit<TableOfContentsProviderProps, "resolvers" | "slugify">,
  ) => React.ReactNode
  TableOfContents: typeof TableOfContents
  TableOfContentsButton: typeof TableOfContentsButton
  tableOfContentsConverter: (data?: DefaultTypedEditorState) => CreateTableOfContentsConverter
}

export function createTableOfContents({
  resolvers,
  slugify = slugifyHeading,
  icon,
}: CreateTableOfContentsOptions = {}): CreateTableOfContents {
  return {
    tableOfContentsField,
    TableOfContentsProvider: (props) => (
      <TableOfContentsProvider {...props} resolvers={resolvers} slugify={slugify} />
    ),
    TableOfContents,
    TableOfContentsButton,
    tableOfContentsConverter: (data) => createTableOfContentsConverter(data, slugify, icon),
  }
}
