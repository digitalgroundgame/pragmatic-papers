import { ChevronLeft, ChevronRight } from "lucide-react"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import React from "react"

import { docNavTitle, docPath } from "@/plugins/docs/sections"
import { cn } from "@/utilities/utils"

interface PagerDoc {
  slug?: string | null
  title: string
  navTitle?: string | null
}

interface DocPagerProps {
  previous?: PagerDoc
  next?: PagerDoc
  className?: string
}

function PagerLink({
  doc,
  direction,
}: {
  doc: PagerDoc
  direction: "previous" | "next"
}): React.ReactNode {
  const next = direction === "next"
  const Icon = next ? ChevronRight : ChevronLeft
  return (
    <HoverPrefetchLink
      href={docPath(doc.slug ?? "")}
      rel={direction === "next" ? "next" : "prev"}
      className={cn(
        "group hover:border-foreground/40 flex flex-col gap-1 rounded-md border p-4 no-underline transition-colors",
        // A lone Next card still sits on the right, where readers look for it.
        next && "items-end text-right sm:col-start-2",
      )}
    >
      <span className="text-muted-foreground text-sm">{next ? "Next" : "Previous"}</span>
      <span className="text-foreground flex items-center gap-1 font-bold">
        {!next && <Icon aria-hidden="true" className="size-4 shrink-0" />}
        {docNavTitle(doc)}
        {next && <Icon aria-hidden="true" className="size-4 shrink-0" />}
      </span>
    </HoverPrefetchLink>
  )
}

/** The previous and next docs in the sidebar's order, as cards at the foot of a doc. */
export function DocPager({ previous, next, className }: DocPagerProps): React.ReactNode {
  if (!previous && !next) return null
  return (
    <nav
      aria-label="Previous and next docs"
      className={cn("grid gap-4 font-sans sm:grid-cols-2", className)}
    >
      {previous && <PagerLink doc={previous} direction="previous" />}
      {next && <PagerLink doc={next} direction="next" />}
    </nav>
  )
}
