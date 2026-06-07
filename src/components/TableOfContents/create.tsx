import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { TableOfContents, TableOfContentsButton } from "./client"
import {
  type CreateTableOfContentsConverter,
  createTableOfContentsConverter,
} from "./createTableOfContentsConverter"
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

interface TableOfContentsWrapperProps {
  content: DefaultTypedEditorState
  classNames?: Record<string, string>
  children?: React.ReactNode
}

interface CreateTableOfContents {
  introAnchor: string
  tableOfContentsField: TableOfContentsField
  TableOfContentsProvider: (props: TableOfContentsWrapperProps) => React.ReactNode
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
    TableOfContentsProvider: ({ content, children, classNames }) => {
      const entries = buildEntries(content, resolvers, slugify, introAnchor)
      return (
        <TableOfContentsProvider entries={entries} classNames={classNames}>
          {children}
        </TableOfContentsProvider>
      )
    },
    TableOfContents,
    TableOfContentsButton,
    tableOfContentsConverter: (data) => createTableOfContentsConverter(data, slugify, icon),
  }
}
