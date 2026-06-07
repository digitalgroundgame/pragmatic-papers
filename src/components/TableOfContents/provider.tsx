"use client"

import { createContext, useContext, useState } from "react"

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
  const activeAnchor = useActiveAnchor(entries)
  const [isOpen, setIsOpen] = useState(true)

  function toggle() {
    return setIsOpen((v) => !v)
  }

  return (
    <TableOfContentsContext.Provider
      value={{
        activeAnchor,
        classNames,
        entries,
        hasEntries,
        isOpen,
        isActive: false,
        toggle,
      }}
    >
      {children}
    </TableOfContentsContext.Provider>
  )
}

function useTableOfContents(anchor?: string): TableOfContentsContextValue {
  const ctx = useContext(TableOfContentsContext)
  if (!ctx) throw new Error("useTableOfContents must be used within a TableOfContentsAnchor")
  return { ...ctx, isActive: anchor === ctx.activeAnchor }
}

export { TableOfContentsProvider, useTableOfContents, type TableOfContentsProviderProps }
