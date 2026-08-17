"use client"

import React, { useEffect, useId, useRef, useState } from "react"

import type { BylineAuthor } from "@/components/Authors/BylineAuthor"
import { AvatarStack } from "@/components/Authors/AvatarStack"
import { splitAuthors } from "@/components/Authors/splitAuthors"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { getSeparator } from "@/utilities/getSeparator"
import { cn } from "@/utilities/utils"

interface BylineProps {
  authors: BylineAuthor[]
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
  const toggleRef = useRef<HTMLButtonElement>(null)
  // Set when the expansion came from the "+N" badge, which removes itself in
  // the process — see the effect below.
  const refocusToggle = useRef(false)
  const namesId = useId()

  // The "+N" badge unmounts as it expands the byline, dropping focus to
  // <body> (WCAG 2.4.3). The text toggle is the same control in words, and it
  // survives the switch, so hand focus to it. The toggle's own clicks need
  // nothing: it keeps its DOM node across both states.
  useEffect(() => {
    if (!refocusToggle.current) return
    refocusToggle.current = false
    toggleRef.current?.focus()
  }, [expanded])

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
        overflowControls={namesId}
        onOverflowClick={
          collapsed
            ? () => {
                refocusToggle.current = true
                setExpanded(true)
              }
            : undefined
        }
      />
      <span>
        <span id={namesId}>
          {shown.map(({ id, slug, name }, index) => (
            <React.Fragment key={id}>
              {getSeparator(index, listLength)}
              <HoverPrefetchLink href={`/authors/${slug}`} className="hover:underline">
                {name}
              </HoverPrefetchLink>
            </React.Fragment>
          ))}
        </span>
        {overflow > 0 && (
          // One button in both states rather than one per state: React then
          // reuses the DOM node, so activating it by keyboard leaves focus on
          // it instead of dropping to <body>, and `aria-expanded` describes a
          // control that is actually still there to be re-pressed.
          <>
            {/* Collapsed, the toggle is the list's last item ("… & 2 more") and
                takes a real separator; expanded, it just trails the names. */}
            {collapsed ? getSeparator(shown.length, listLength) : " "}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={namesId}
              className={cn(
                "focus-visible:ring-ring cursor-pointer rounded-sm underline-offset-4 focus-visible:ring-2 focus-visible:outline-none",
                collapsed
                  ? // "N more" closes the list of names, so it keeps the
                    // byline's brand colour and behaves like the author links
                    // beside it.
                    "hover:underline"
                  : // "Show less" trails the names instead of belonging to
                    // them: muted and permanently underlined so it reads as a
                    // control rather than as one more author.
                    "text-muted-foreground hover:text-foreground underline",
              )}
            >
              {collapsed ? `${overflow} more` : "Show less"}
            </button>
          </>
        )}
      </span>
    </>
  )
}
