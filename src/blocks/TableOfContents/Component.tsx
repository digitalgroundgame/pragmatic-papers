import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { cn } from "@/utilities/utils"

import { slugifyHeading } from "./slug"
import { collectEntries } from "./traverse"
import type { SlugifyFn, TocResolverMap } from "./types"

interface BaseTableOfContentsProps {
  content: DefaultTypedEditorState
  className?: string
  title?: string
  resolvers?: TocResolverMap
  slugify?: SlugifyFn
}

export function BaseTableOfContents({
  content,
  className,
  title = "Table of Contents",
  resolvers,
  slugify = slugifyHeading,
}: BaseTableOfContentsProps): React.ReactNode {
  const entries = collectEntries(content, resolvers, slugify)
  if (entries.length === 0) return null

  return (
    <nav aria-label="Table of contents" className={cn("toc", className)}>
      {title ? <h3 className="toc__title border-b text-2xl">{title}</h3> : null}
      <ol className="toc__list mt-2 list-none space-y-1 p-0">
        {entries.map((entry, index) => {
          const depth = entry.depth ?? 1
          const Icon = entry.icon
          return (
            <li
              key={`${entry.anchor || "entry"}-${index}`}
              className="toc__item"
              style={{ paddingInlineStart: `${(depth - 1) * 1}rem` }}
            >
              <a
                href={entry.anchor ? `#${entry.anchor}` : "#"}
                className="toc__link inline-flex items-center gap-2 no-underline hover:underline"
              >
                {Icon && <Icon aria-hidden="true" className="toc__icon size-4 shrink-0" />}
                <span className="toc__label">{entry.label}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
