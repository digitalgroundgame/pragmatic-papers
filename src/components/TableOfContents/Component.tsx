import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { cn } from "@/utilities/utils"

import { Link } from "lucide-react"
import { TableOfContentsClient } from "./TableOfContentsClient"
import { slugifyHeading } from "./slug"
import { collectEntries, nestEntries } from "./traverse"
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

function renderEntries(
  entries?: TableOfContentsEntry[],
  classNames?: TableOfContentsClassNames,
  isRoot = true,
): React.ReactNode {
  if (!entries) return null
  return (
    <ul className={cn("toc__list pl-4", isRoot && cn("text-sm", classNames?.list))}>
      {entries.map((entry, index) => {
        const Icon = entry.icon
        return (
          <li
            key={`${entry.anchor || "entry"}-${index}`}
            className={cn("toc__item space-x-1", classNames?.item)}
          >
            <a
              href={entry.anchor ? `#${entry.anchor}` : "#"}
              className={cn(
                "toc__link group inline-flex items-center gap-1 no-underline hover:underline",
                classNames?.link,
              )}
            >
              {Icon ? (
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "toc__icon text-muted-foreground size-4 shrink-0",
                    classNames?.icon,
                  )}
                />
              ) : (
                <Link
                  aria-hidden="true"
                  className={cn(
                    "toc__icon text-muted-foreground size-4 shrink-0 opacity-0 group-hover:opacity-100",
                    classNames?.icon,
                  )}
                />
              )}
              <span className={cn("toc__label", classNames?.label)}>{entry.label}</span>
            </a>
            {renderEntries(entry.children, classNames, false)}
          </li>
        )
      })}
    </ul>
  )
}

export function TableOfContents({
  content,
  className,
  classNames,
  title = "Table of Contents",
  resolvers,
  slugify = slugifyHeading,
}: TableOfContentsProps): React.ReactNode {
  const entries = nestEntries(collectEntries(content, resolvers, slugify))
  if (entries.length === 0) return null

  return (
    <TableOfContentsClient className={className} classNames={classNames} title={title}>
      {renderEntries(entries, classNames)}
    </TableOfContentsClient>
  )
}
