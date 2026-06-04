import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { TableOfContents, type TableOfContentsProps } from "./Component"
import { type TableOfContentsField, tableOfContentsField } from "./field"
import { type CreateHeaderingConverter, createHeadingConverter } from "./headingConverter"
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
  tableOfContentsConverter: (data?: DefaultTypedEditorState) => CreateHeaderingConverter
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
    tableOfContentsConverter: (data) => createHeadingConverter(data, slugify, icon),
  }
}
