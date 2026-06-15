"use client"

import { LinkIcon, List } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

import { useTableOfContents } from "./provider"
import { type TableOfContentsEntry } from "./types"

interface TableOfContentsIconProps {
  icon?: React.ReactNode
  isActive: boolean
  className?: string
}

function TableOfContentsIcon({
  icon,
  isActive,
  className,
}: TableOfContentsIconProps): React.ReactNode {
  const visibilityClass = cn("toc__icon", className)
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
      className: cn((icon.props as { className?: string }).className, visibilityClass),
    })
  }
  return (
    <LinkIcon
      aria-hidden="true"
      className={cn(
        "text-muted-foreground size-3 shrink-0 opacity-0 group-hover:opacity-100",
        isActive && "opacity-100",
        visibilityClass,
      )}
    />
  )
}

interface TableOfContentsLinkProps extends React.ComponentProps<"a"> {
  entry: TableOfContentsEntry
}

function TableOfContentsLink({ entry, ...props }: TableOfContentsLinkProps): React.ReactNode {
  const { classNames, isActive } = useTableOfContents(entry.anchor)
  return (
    <a
      href={entry.anchor ? `#${entry.anchor}` : "#"}
      className={cn(
        "toc__link group inline-flex items-center gap-1 no-underline hover:underline",
        isActive && "underline",
        classNames?.link,
      )}
      {...props}
    >
      <TableOfContentsIcon icon={entry.icon} isActive={isActive} className={classNames?.icon} />
      <span className={cn("toc__label", classNames?.label)}>{entry.label}</span>
    </a>
  )
}

function TableOfContentsItem({
  className,
  children,
  ...props
}: React.ComponentProps<"li">): React.ReactNode {
  const { classNames } = useTableOfContents()
  return (
    <li className={cn("toc__item", classNames?.item, className)} {...props}>
      {children}
    </li>
  )
}

interface TableOfContentsListProps extends React.ComponentProps<"ul"> {
  entries?: TableOfContentsEntry[]
}

function TableOfContentsList({
  entries,
  className,
  ...props
}: TableOfContentsListProps): React.ReactNode {
  if (!entries) return null
  return (
    <ul className={cn("toc__list", className)} {...props}>
      {entries.map((entry, index) => (
        <TableOfContentsItem key={`${entry.anchor || "entry"}-${index}`}>
          <TableOfContentsLink entry={entry} />
          <TableOfContentsList entries={entry.children} className="pl-4" />
        </TableOfContentsItem>
      ))}
    </ul>
  )
}

function TableOfContentsButton({
  className,
  ...props
}: React.ComponentProps<"button">): React.ReactNode {
  const { classNames, hasEntries, isOpen, toggle } = useTableOfContents()
  if (!hasEntries) return null
  return (
    <Button
      variant={isOpen ? "outline" : "ghost"}
      size="icon-sm"
      aria-controls="toc__nav"
      aria-expanded={isOpen}
      aria-label={isOpen ? "Collapse table of contents" : "Expand table of contents"}
      onClick={toggle}
      className={cn("toc__toggleButton", classNames?.toggleButton, className)}
      {...props}
    >
      <List aria-hidden="true" />
    </Button>
  )
}

function TableOfContentsTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h3">): React.ReactNode {
  const { classNames } = useTableOfContents()
  return (
    <h3 className={cn("toc__title flex-1 text-3xl", classNames?.title, className)} {...props}>
      {children}
    </h3>
  )
}

function TableOfContentHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">): React.ReactNode {
  const { classNames } = useTableOfContents()
  return (
    <div
      className={cn("toc__titleContainer flex gap-2", classNames?.titleContainer, className)}
      {...props}
    >
      {children}
    </div>
  )
}

function TableOfContentsBody({
  children,
  className,
  ...props
}: React.ComponentProps<"nav">): React.ReactNode {
  const { isOpen } = useTableOfContents()
  return (
    <nav
      hidden={!isOpen}
      aria-label="Table of contents"
      className={cn("toc__nav w-full", className)}
      {...props}
    >
      {children}
    </nav>
  )
}

interface TableOfContentsProps {
  className?: string
  title?: string
}

function TableOfContents({
  className,
  title = "Table of Contents",
}: TableOfContentsProps): React.ReactNode {
  const { hasEntries, entries, classNames } = useTableOfContents()
  if (!hasEntries) return null
  return (
    <TableOfContentsBody className={className}>
      {title && (
        <TableOfContentHeader>
          <TableOfContentsTitle>{title}</TableOfContentsTitle>
        </TableOfContentHeader>
      )}
      <TableOfContentsList
        entries={entries}
        className={cn("md:-translate-x-4", classNames?.list)}
      />
    </TableOfContentsBody>
  )
}

export { TableOfContents, TableOfContentsButton }
