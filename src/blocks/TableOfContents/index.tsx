import React from "react"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"

import { TableOfContents } from "./Component"
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
  field: typeof tableOfContentsField
  Component: (props: {
    content: DefaultTypedEditorState
    className?: string
    title?: string
  }) => React.ReactNode
  headingConverter: (data: DefaultTypedEditorState) => ReturnType<typeof createHeadingConverter>
} {
  const slugify: SlugifyFn = options.slugify ?? slugifyHeading
  const resolvers: TocResolverMap = options.resolvers ?? {}

  return {
    field: tableOfContentsField,
    Component: ({ content, className, title }) => (
      <TableOfContents
        content={content}
        className={className}
        title={title}
        resolvers={resolvers}
        slugify={slugify}
      />
    ),
    headingConverter: (data) => createHeadingConverter(data, slugify),
  }
}
