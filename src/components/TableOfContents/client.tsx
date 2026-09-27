"use client"

import { LinkIcon, List } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

import { useTableOfContents } from "./provider"
import { type TableOfContentsEntry } from "./types"
import { useActiveAnchor } from "./useActiveAnchor"

interface TableOfContentsIconProps {
  icon?: React.ReactNode
  isActive: boolean
}

function TableOfContentsIcon({ icon, isActive }: TableOfContentsIconProps): React.ReactNode {
  const iconClass = "absolute top-[0.5lh] right-full mr-0.5 -translate-y-1/2"
  if (React.isValidElement(icon)) {
    return React.cloneElement(
      icon as React.ReactElement<{ className?: string; "data-slot"?: string }>,
      {
        "data-slot": "toc-icon",
        className: cn((icon.props as { className?: string }).className, iconClass),
      },
    )
  }
  return (
    <LinkIcon
      aria-hidden="true"
      data-slot="toc-icon"
      className={cn(
        "text-muted-foreground size-3 shrink-0 opacity-0 group-hover:opacity-100",
        isActive && "opacity-100",
        iconClass,
      )}
    />
  )
}

interface TableOfContentsLinkProps extends React.ComponentProps<"a"> {
  entry: TableOfContentsEntry
  isActive: boolean
}

function TableOfContentsLink({
  entry,
  isActive,
  ...props
}: TableOfContentsLinkProps): React.ReactNode {
  return (
    <a
      href={entry.anchor ? `#${entry.anchor}` : "#"}
      data-slot="toc-link"
      className={cn(
        "group relative inline-flex items-center no-underline hover:underline",
        isActive && "underline",
      )}
      {...props}
    >
      <TableOfContentsIcon icon={entry.icon} isActive={isActive} />
      <span data-slot="toc-label">{entry.label}</span>
    </a>
  )
}

interface TableOfContentsListProps extends React.ComponentProps<"ul"> {
  entries?: TableOfContentsEntry[]
  activeAnchor: string | null
}

function TableOfContentsList({
  entries,
  activeAnchor,
  className,
  ...props
}: TableOfContentsListProps): React.ReactNode {
  if (!entries) return null
  return (
    <ul data-slot="toc-list" className={className} {...props}>
      {entries.map((entry, index) => (
        <li key={`${entry.anchor || "entry"}-${index}`} data-slot="toc-item">
          <TableOfContentsLink entry={entry} isActive={entry.anchor === activeAnchor} />
          <TableOfContentsList
            entries={entry.children}
            activeAnchor={activeAnchor}
            className="pl-4"
          />
        </li>
      ))}
    </ul>
  )
}

function TableOfContentsButton({
  className,
  ...props
}: React.ComponentProps<"button">): React.ReactNode {
  const { isOpen, navId, toggle } = useTableOfContents()
  return (
    <Button
      variant={isOpen ? "outline" : "ghost"}
      size="icon-sm"
      aria-controls={navId}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Collapse table of contents" : "Expand table of contents"}
      onClick={toggle}
      className={className}
      {...props}
    >
      <List aria-hidden="true" />
    </Button>
  )
}

interface TableOfContentsProps {
  entries: TableOfContentsEntry[]
  className?: string
  title?: string
}

function TableOfContents({
  entries,
  className,
  title = "Table of Contents",
}: TableOfContentsProps): React.ReactNode {
  const { isOpen, navId } = useTableOfContents()
  const activeAnchor = useActiveAnchor(entries, 120, isOpen)
  if (!entries.length) return null
  return (
    <nav
      id={navId}
      data-slot="toc"
      hidden={!isOpen}
      aria-label="Table of contents"
      className={cn("w-full", className)}
    >
      {title && (
        <div data-slot="toc-header" className="mb-1 flex gap-2">
          <h3 data-slot="toc-title" className="flex-1 text-3xl">
            {title}
          </h3>
        </div>
      )}
      <TableOfContentsList entries={entries} activeAnchor={activeAnchor} />
    </nav>
  )
}

export { TableOfContents, TableOfContentsButton }
