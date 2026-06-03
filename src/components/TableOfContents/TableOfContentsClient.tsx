"use client"

import { List } from "lucide-react"
import React, { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

import type { TableOfContentsClassNames } from "./Component"

interface TableOfContentsClientProps {
  className?: string
  classNames?: TableOfContentsClassNames
  title?: string
  children: React.ReactNode
}

export function TableOfContentsClient({
  className,
  classNames,
  title,
  children,
}: TableOfContentsClientProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <nav aria-label="Table of contents" className={cn("toc space-y-2", className)}>
      <div className={cn("toc__titleContainer flex gap-2", classNames?.titleContainer)}>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={isOpen ? "Collapse table of contents" : "Expand table of contents"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
          className={cn("toc__toggleButton", classNames?.toggleButton)}
        >
          <List aria-hidden="true" />
        </Button>
        {title && isOpen && (
          <h3 className={cn("toc__title flex-1 border-b text-2xl", classNames?.title)}>{title}</h3>
        )}
      </div>
      {isOpen && children}
    </nav>
  )
}
