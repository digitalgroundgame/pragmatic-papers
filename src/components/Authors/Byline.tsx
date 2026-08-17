"use client"

import type { User } from "@/payload-types"
import React, { useState } from "react"

import { AvatarStack } from "@/components/Authors/AvatarStack"
import { splitAuthors } from "@/components/Authors/splitAuthors"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { getSeparator } from "@/utilities/getSeparator"

interface BylineProps {
  authors: User[]
}

/**
 * The article byline: a stack of author avatars followed by their names.
 *
 * Past three authors both halves collapse together — two names and a
 * remainder, two faces and a "+N" — and either remainder expands the whole
 * thing. The avatars and the names therefore have to share one piece of state,
 * which is why this is a single client component rather than the stack and the
 * list sitting side by side in the hero.
 */
export function Byline({ authors }: BylineProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false)

  const { visible, overflow } = splitAuthors(authors)
  const collapsed = overflow > 0 && !expanded
  const shown = collapsed ? visible : authors
  // The remainder occupies the final slot while collapsed, so the separators —
  // and the Oxford comma, which depends on which item is last — count it as one
  // of the items.
  const listLength = shown.length + (collapsed ? 1 : 0)

  if (!authors.length) return null

  return (
    <>
      <AvatarStack
        authors={authors}
        maxVisible={collapsed ? undefined : authors.length}
        onOverflowClick={collapsed ? () => setExpanded(true) : undefined}
      />
      <span>
        {shown.map(({ id, slug, name }, index) => (
          <React.Fragment key={id}>
            {getSeparator(index, listLength)}
            <HoverPrefetchLink href={`/authors/${slug}`} className="hover:underline">
              {name}
            </HoverPrefetchLink>
          </React.Fragment>
        ))}
        {collapsed && (
          <>
            {getSeparator(shown.length, listLength)}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-expanded={false}
              className="focus-visible:ring-ring cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {overflow} more
            </button>
          </>
        )}
        {overflow > 0 && expanded && (
          <>
            {" "}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded
              className="focus-visible:ring-ring cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Show less
            </button>
          </>
        )}
      </span>
    </>
  )
}
