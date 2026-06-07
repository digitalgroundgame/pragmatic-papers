"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

import type { TableOfContentsEntry } from "./types"
import { useActiveAnchor } from "./useActiveAnchor"

interface TableOfContentsClassNames {
  title?: string
  titleContainer?: string
  list?: string
  item?: string
  link?: string
  icon?: string
  label?: string
  toggleButton?: string
}

interface TableOfContentsContextValue {
  activeAnchor: string | null
  classNames?: TableOfContentsClassNames
  entries: TableOfContentsEntry[]
  hasEntries: boolean
  isOpen: boolean
  isActive: boolean
  toggle: () => void
}

const TableOfContentsContext = createContext<TableOfContentsContextValue | null>(null)

interface TableOfContentsProviderProps {
  entries: TableOfContentsEntry[]
  classNames?: TableOfContentsClassNames
  children?: React.ReactNode
}

function TableOfContentsProvider({
  entries,
  classNames,
  children,
}: TableOfContentsProviderProps): React.ReactNode {
  const hasEntries = entries.length > 0
  const [isOpen, setIsOpen] = useState(true)
  const activeAnchor = useActiveAnchor(entries, 120, isOpen)

  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  const value = useMemo(
    () => ({ activeAnchor, classNames, entries, hasEntries, isOpen, isActive: false, toggle }),
    [activeAnchor, classNames, entries, hasEntries, isOpen, toggle],
  )

  return <TableOfContentsContext.Provider value={value}>{children}</TableOfContentsContext.Provider>
}

function useTableOfContents(anchor?: string): TableOfContentsContextValue {
  const ctx = useContext(TableOfContentsContext)
  if (!ctx) throw new Error("useTableOfContents must be used within a TableOfContentsProvider")
  return { ...ctx, isActive: anchor === ctx.activeAnchor }
}

export { TableOfContentsProvider, useTableOfContents, type TableOfContentsProviderProps }
