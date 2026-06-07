"use client"

import { type DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { createContext, useContext, useState } from "react"

import { buildEntries } from "./traverse"
import type { SlugifyFn, TableOfContentsEntry, TableOfContentsResolverMap } from "./types"
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
  content: DefaultTypedEditorState
  classNames?: TableOfContentsClassNames
  resolvers?: TableOfContentsResolverMap
  children?: React.ReactNode
  slugify?: SlugifyFn
}

function TableOfContentsProvider({
  content,
  classNames,
  resolvers,
  slugify,
  children,
}: TableOfContentsProviderProps): React.ReactNode {
  const entries = buildEntries(content, resolvers, slugify)
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
