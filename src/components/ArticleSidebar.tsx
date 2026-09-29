import React from "react"

import { cn } from "@/utilities/utils"

export function ArticleSidebar({
  children,
  className,
}: React.ComponentProps<"aside">): React.ReactNode {
  return (
    <aside
      className={cn(
        "max-w-2xl self-start lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:mb-8",
        "toc-open:mx-auto toc-open:w-full",
        className,
      )}
    >
      {children}
    </aside>
  )
}
