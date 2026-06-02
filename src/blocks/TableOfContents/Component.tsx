import React from "react"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"

import { cn } from "@/utilities/utils"

import { slugifyHeading } from "./slug"
import { collectEntries } from "./traverse"
import type { SlugifyFn, TocResolverMap } from "./types"

interface Props {
  content: DefaultTypedEditorState
  className?: string
  title?: string
  resolvers?: TocResolverMap
  slugify?: SlugifyFn
}

export function TableOfContents({
  content,
  className,
  title = "Contents",
  resolvers,
  slugify = slugifyHeading,
}: Props): React.ReactNode {
  const entries = collectEntries(content, resolvers, slugify)
  if (entries.length === 0) return null

  return (
    <nav aria-label="Table of contents" className={cn("toc not-prose", className)}>
      {title ? <h2 className="toc__title text-lg font-semibold">{title}</h2> : null}
      <ol className="toc__list mt-2 list-none space-y-1 p-0">
        {entries.map((entry, index) => {
          const depth = entry.depth ?? 1
          const Icon = entry.icon
          return (
            <li
              key={`${entry.anchor || "entry"}-${index}`}
              className="toc__item leading-snug"
              style={{ paddingInlineStart: `${(depth - 1) * 1}rem` }}
            >
              <a
                href={entry.anchor ? `#${entry.anchor}` : "#"}
                className="toc__link inline-flex items-center gap-2 no-underline hover:underline"
              >
                {Icon ? <Icon aria-hidden="true" className="toc__icon size-4 shrink-0" /> : null}
                <span className="toc__label">{entry.label}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
