import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { Field } from "payload"
import React from "react"

import { BaseTableOfContents } from "./Component"
import { tableOfContentsField } from "./field"
import { createHeadingConverter } from "./headingConverter"
import { slugifyHeading } from "./slug"
import type {
  CreateTableOfContentsOptions,
  SlugifyFn,
  TocEntry,
  TocResolver,
  TocResolverMap,
} from "./types"

export type { CreateTableOfContentsOptions, SlugifyFn, TocEntry, TocResolver, TocResolverMap }

export function createTableOfContents(options: CreateTableOfContentsOptions = {}): {
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
    TableOfContents: ({ content, className, title }) => (
      <BaseTableOfContents
        content={content}
        className={className}
        title={title}
        resolvers={options.resolvers}
        slugify={slugify}
      />
    ),
    tableOfContentsConverter: (data) => createHeadingConverter(data, slugify),
  }
}
