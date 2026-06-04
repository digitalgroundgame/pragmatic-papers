import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { cn } from "@/utilities/utils"

import {
  type SerializableEntry,
  TableOfContentsAnchor,
  TableOfContentsHeader,
  TableOfContentsList,
} from "./TableOfContentsLinks"
import { slugifyHeading } from "./slug"
import { buildEntries } from "./traverse"
import type { SlugifyFn, TableOfContentsEntry, TableOfContentsResolverMap } from "./types"

export interface TableOfContentsClassNames {
  title?: string
  titleContainer?: string
  list?: string
  item?: string
  link?: string
  icon?: string
  label?: string
  toggleButton?: string
}

export interface TableOfContentsProps {
  content: DefaultTypedEditorState
  className?: string
  classNames?: TableOfContentsClassNames
  title?: string
  resolvers?: TableOfContentsResolverMap
  slugify?: SlugifyFn
}

function toSerializableEntry(
  entry: TableOfContentsEntry,
  iconClassName?: string,
): SerializableEntry {
  const { icon: Icon, children, ...rest } = entry
  return {
    ...rest,
    icon: Icon ? (
      <Icon
        aria-hidden="true"
        className={cn("toc__icon text-muted-foreground size-4 shrink-0", iconClassName)}
      />
    ) : undefined,
    children: children?.map((c) => toSerializableEntry(c, iconClassName)),
  }
}

export function TableOfContents({
  content,
  className,
  classNames,
  title = "Table of Contents",
  resolvers,
  slugify = slugifyHeading,
}: TableOfContentsProps): React.ReactNode {
  const entries = buildEntries(content, resolvers, slugify)
  if (entries.length === 0) return null

  const serializable = entries.map((e) => toSerializableEntry(e, classNames?.icon))

  return (
    <TableOfContentsHeader className={className} classNames={classNames} title={title}>
      <TableOfContentsAnchor entries={serializable} classNames={classNames}>
        <TableOfContentsList entries={serializable} isRoot />
      </TableOfContentsAnchor>
    </TableOfContentsHeader>
  )
}
