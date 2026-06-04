"use client"

import { Link, List } from "lucide-react"
import React, { createContext, useContext, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

import type { TableOfContentsClassNames } from "./Component"
import { useActiveAnchor } from "./useActiveAnchor"

export interface SerializableEntry {
  label: string
  anchor: string
  depth?: number
  icon?: React.ReactNode
  children?: SerializableEntry[]
}

interface TableOfContentsContextValue {
  activeAnchor: string | null
  classNames?: TableOfContentsClassNames
}

const TableOfContentsContext = createContext<TableOfContentsContextValue>({ activeAnchor: null })

function useTableOfContentsContext() {
  return useContext(TableOfContentsContext)
}

export function TableOfContentsLink({ entry }: { entry: SerializableEntry }): React.ReactNode {
  const { activeAnchor, classNames } = useTableOfContentsContext()
  const isActive = !!entry.anchor && entry.anchor === activeAnchor
  return (
    <a
      href={entry.anchor ? `#${entry.anchor}` : "#"}
      className={cn(
        "toc__link group inline-flex items-center gap-1 no-underline hover:underline",
        isActive && "underline",
        classNames?.link,
      )}
    >
      {entry.icon ?? (
        <Link
          aria-hidden="true"
          className={cn(
            "toc__icon text-muted-foreground size-3 shrink-0 opacity-0 group-hover:opacity-100",
            isActive && "opacity-100",
            classNames?.icon,
          )}
        />
      )}
      <span className={cn("toc__label", classNames?.label)}>{entry.label}</span>
    </a>
  )
}

export function TableOfContentsItem({
  entry,
  children,
}: {
  entry: SerializableEntry
  children?: React.ReactNode
}): React.ReactNode {
  const { classNames } = useTableOfContentsContext()
  return (
    <li className={cn("toc__item space-x-1", classNames?.item)}>
      <TableOfContentsLink entry={entry} />
      {children}
    </li>
  )
}

export function TableOfContentsList({
  entries,
  isRoot = false,
}: {
  entries?: SerializableEntry[]
  isRoot?: boolean
}): React.ReactNode {
  const { classNames } = useTableOfContentsContext()
  if (!entries?.length) return null
  return (
    <ul className={cn("toc__list pl-4", isRoot && cn("text-sm", classNames?.list))}>
      {entries.map(({ children, ...entry }, index) => (
        <TableOfContentsItem key={`${entry.anchor || "entry"}-${index}`} entry={entry}>
          <TableOfContentsList entries={children} />
        </TableOfContentsItem>
      ))}
    </ul>
  )
}

interface TableOfContentsLinksProps {
  entries: SerializableEntry[]
  classNames?: TableOfContentsClassNames
  children?: React.ReactNode
}

export function TableOfContentsAnchor({
  entries,
  classNames,
  children,
}: TableOfContentsLinksProps): React.ReactNode {
  const activeAnchor = useActiveAnchor(entries)
  return (
    <TableOfContentsContext.Provider value={{ activeAnchor, classNames }}>
      {children}
    </TableOfContentsContext.Provider>
  )
}

interface TableOfContentsClientProps {
  className?: string
  classNames?: TableOfContentsClassNames
  title?: string
  children: React.ReactNode
}

export function TableOfContentsHeader({
  className,
  classNames,
  title,
  children,
}: TableOfContentsClientProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <nav aria-label="Table of contents" className={cn("toc space-y-2", className)}>
      <div className={cn("toc__titleContainer flex gap-2", classNames?.titleContainer)}>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={isOpen ? "Collapse table of contents" : "Expand table of contents"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
          className={cn("toc__toggleButton", classNames?.toggleButton)}
        >
          <List aria-hidden="true" />
        </Button>
        {title && isOpen && (
          <h3 className={cn("toc__title flex-1 border-b text-2xl", classNames?.title)}>{title}</h3>
        )}
      </div>
      {isOpen && children}
    </nav>
  )
}
