import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { TableOfContents, type TableOfContentsProps } from "./Component"
import { TableOfContentsButton } from "./client"
import {
  type CreateTableOfContentsConverter,
  createTableOfContentsConverter,
} from "./createTableOfContentsConverter"
import { type TableOfContentsField, tableOfContentsField } from "./field"
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
  TableOfContents: (props: TableOfContentsProps) => React.ReactNode
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
    TableOfContents: (props) => (
      <TableOfContents {...props} resolvers={resolvers} slugify={slugify} />
    ),
    TableOfContentsButton,
    tableOfContentsConverter: (data) => createTableOfContentsConverter(data, slugify, icon),
  }
}
