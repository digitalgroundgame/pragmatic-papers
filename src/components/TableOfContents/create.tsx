import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { FieldHook, TypeWithID } from "payload"
import React from "react"

import {
  TableOfContents as TableOfContentsClient,
  TableOfContentsButton as TableOfContentsButtonClient,
} from "./client"
import { type CreateTableOfContentsConverter, createTableOfContentsConverter } from "./converter"
import { type TableOfContentsField, tableOfContentsField } from "./field"
import { TableOfContentsProvider } from "./provider"
import { slugifyHeading } from "./slug"
import { buildEntries, stampAnchors } from "./traverse"
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
  tableOfContentsConverter: CreateTableOfContentsConverter
  tableOfContentsEntries: (content: DefaultTypedEditorState) => TableOfContentsEntry[]
  populateTableOfContentsAnchors: FieldHook<TypeWithID, DefaultTypedEditorState | null | undefined>
}

export function createTableOfContents({
  resolvers,
  slugify = slugifyHeading,
  icon,
  introAnchor = "intro",
}: CreateTableOfContentsOptions = {}): CreateTableOfContents {
  const entriesFor = (content: DefaultTypedEditorState) =>
    buildEntries(content, resolvers, introAnchor)

  return {
    introAnchor,
    tableOfContentsField,
    TableOfContentsProvider,
    TableOfContents: ({ content, ...props }) => (
      <TableOfContentsClient entries={entriesFor(content)} {...props} />
    ),
    TableOfContentsButton: ({ content, ...props }) =>
      entriesFor(content).length > 0 ? <TableOfContentsButtonClient {...props} /> : null,
    tableOfContentsConverter: createTableOfContentsConverter(icon),
    tableOfContentsEntries: entriesFor,
    populateTableOfContentsAnchors: ({ value }) => (value ? stampAnchors(value, slugify) : value),
  }
}
