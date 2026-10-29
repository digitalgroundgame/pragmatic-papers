import React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/utilities/utils"

/**
 * The column beside an article's text that holds its table of contents. While it sticks,
 * `--sidebar-max-height` caps it at the room left below the header (and the ticker), and
 * a longer table of contents scrolls inside it. A page that sticks it at another width sets
 * the variable at that width instead.
 */
export function ArticleSidebar({
  children,
  className,
}: React.ComponentProps<"aside">): React.ReactNode {
  return (
    <aside
      className={cn(
        "max-w-2xl self-start lg:sticky lg:top-[calc(var(--sticky-top)+1rem)] lg:mb-8",
        "lg:[--sidebar-max-height:calc(100vh-var(--sticky-top)-2rem)]",
        "toc-open:mx-auto toc-open:w-full",
        className,
      )}
    >
      {/* Scrolling clips what overflows sideways too, so the padding keeps room for the
          icons that hang left of the entries, and the margin keeps the text where it was.
          The cap goes on the viewport, the element that scrolls. */}
      <ScrollArea
        data-slot="sidebar-scroll"
        className="-ml-4 [&>[data-slot=scroll-area-viewport]]:max-h-(--sidebar-max-height,none) [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
      >
        <div className="pr-3 pb-1 pl-4">{children}</div>
      </ScrollArea>
    </aside>
  )
}
