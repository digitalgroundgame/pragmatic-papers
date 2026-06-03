import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { Field } from "payload"
import React from "react"

import { TableOfContents } from "./Component"
import { tableOfContentsField } from "./field"
import { createHeadingConverter } from "./headingConverter"
import { slugifyHeading } from "./slug"
import type {
  CreateTableOfContentsOptions,
  SlugifyFn,
  TableOfContentsEntry,
  TableOfContentsResolverMap,
  TocResolver,
} from "./types"

export type {
  CreateTableOfContentsOptions,
  SlugifyFn,
  TableOfContentsEntry,
  TableOfContentsResolverMap,
  TocResolver,
}

export function createTableOfContents(options: CreateTableOfContentsOptions): {
  tableOfContentsField: Field
  TableOfContents: (props: {
    content: DefaultTypedEditorState
    className?: string
    title?: string
  }) => React.ReactNode
  tableOfContentsConverter: (
    data: DefaultTypedEditorState,
  ) => ReturnType<typeof createHeadingConverter>
} {
  const slugify = options.slugify ?? slugifyHeading
  return {
    tableOfContentsField,
    TableOfContents: (props) => (
      <TableOfContents {...props} resolvers={options.resolvers} slugify={slugify} />
    ),
    tableOfContentsConverter: (data) => createHeadingConverter(data, slugify),
  }
}
