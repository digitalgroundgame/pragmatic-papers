"use client"
import React from "react"

import { cn } from "@/utilities/utils"
import { useTableOfContents } from "./TableOfContents/provider"

export function ArticleSidebar({
  children,
  className,
}: React.ComponentProps<"aside">): React.ReactNode {
  const { isOpen } = useTableOfContents()
  return (
    <aside
      className={cn(
        "max-w-2xl self-start lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:mb-8",
        isOpen && "mx-auto w-full",
        className,
      )}
    >
      {children}
    </aside>
  )
}
