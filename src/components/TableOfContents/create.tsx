import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import {
  TableOfContents as TableOfContentsClient,
  TableOfContentsButton as TableOfContentsButtonClient,
} from "./client"
import { type CreateTableOfContentsConverter, createTableOfContentsConverter } from "./converter"
import { type TableOfContentsField, tableOfContentsField } from "./field"
import { TableOfContentsProvider } from "./provider"
import { slugifyHeading } from "./slug"
import { buildEntries } from "./traverse"
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

interface TableOfContentsProps {
  content: DefaultTypedEditorState
  className?: string
  title?: string
}

interface TableOfContentsButtonProps extends Omit<React.ComponentProps<"button">, "content"> {
  content: DefaultTypedEditorState
}

interface CreateTableOfContents {
  introAnchor: string
  tableOfContentsField: TableOfContentsField
  TableOfContentsProvider: typeof TableOfContentsProvider
  TableOfContents: (props: TableOfContentsProps) => React.ReactNode
  TableOfContentsButton: (props: TableOfContentsButtonProps) => React.ReactNode
  tableOfContentsConverter: (data?: DefaultTypedEditorState) => CreateTableOfContentsConverter
}

export function createTableOfContents({
  resolvers,
  slugify = slugifyHeading,
  icon,
  introAnchor = "intro",
}: CreateTableOfContentsOptions = {}): CreateTableOfContents {
  const entriesFor = (content: DefaultTypedEditorState) =>
    buildEntries(content, resolvers, slugify, introAnchor)

  return {
    introAnchor,
    tableOfContentsField,
    TableOfContentsProvider,
    TableOfContents: ({ content, ...props }) => (
      <TableOfContentsClient entries={entriesFor(content)} {...props} />
    ),
    TableOfContentsButton: ({ content, ...props }) =>
      entriesFor(content).length > 0 ? <TableOfContentsButtonClient {...props} /> : null,
    tableOfContentsConverter: (data) => createTableOfContentsConverter(data, slugify, icon),
  }
}
