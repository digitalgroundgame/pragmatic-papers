import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { cn } from "@/utilities/utils"

import { TableOfContentsClient } from "./TableOfContentsClient"
import { slugifyHeading } from "./slug"
import { collectEntries } from "./traverse"
import type { SlugifyFn, TableOfContentsResolverMap } from "./types"

export interface TableOfContentsClassNames {
  title?: string
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

export function TableOfContents({
  content,
  className,
  classNames,
  title = "Table of Contents",
  resolvers,
  slugify = slugifyHeading,
}: TableOfContentsProps): React.ReactNode {
  const entries = collectEntries(content, resolvers, slugify)
  if (entries.length === 0) return null

  return (
    <TableOfContentsClient className={className} classNames={classNames} title={title}>
      <ol className={cn("toc__list mt-1 list-outside space-y-1 p-0 text-sm", classNames?.list)}>
        {entries.map((entry, index) => {
          const depth = entry.depth ?? 1
          const Icon = entry.icon
          return (
            <li
              key={`${entry.anchor || "entry"}-${index}`}
              className={cn("toc__item", classNames?.item)}
              style={{ paddingInlineStart: `${(depth - 1) * 1}rem` }}
            >
              <a
                href={entry.anchor ? `#${entry.anchor}` : "#"}
                className={cn(
                  "toc__link inline-flex items-center gap-1 no-underline hover:underline",
                  classNames?.link,
                )}
              >
                {Icon && (
                  <Icon
                    aria-hidden="true"
                    className={cn("toc__icon size-4 shrink-0", classNames?.icon)}
                  />
                )}
                <span className={cn("toc__label", classNames?.label)}>{entry.label}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </TableOfContentsClient>
  )
}
