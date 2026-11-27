"use client"

import { createContext, useContext, useId, useState } from "react"

interface TableOfContentsContextValue {
  isOpen: boolean
  navId: string
  toggle: () => void
}

const TableOfContentsContext = createContext<TableOfContentsContextValue | null>(null)

interface TableOfContentsProviderProps {
  children?: React.ReactNode
}

function TableOfContentsProvider({ children }: TableOfContentsProviderProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(true)
  const navId = useId()
  const toggle = () => setIsOpen((v) => !v)
  const value = { isOpen, navId, toggle }

  return <TableOfContentsContext.Provider value={value}>{children}</TableOfContentsContext.Provider>
}

function useTableOfContents(): TableOfContentsContextValue {
  const ctx = useContext(TableOfContentsContext)
  if (!ctx) throw new Error("useTableOfContents must be used within a TableOfContentsProvider")
  return ctx
}

export { TableOfContentsProvider, useTableOfContents, type TableOfContentsProviderProps }
