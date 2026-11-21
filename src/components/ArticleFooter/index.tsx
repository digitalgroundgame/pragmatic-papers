import React from "react"

import { cn } from "@/utilities/utils"

/** Spaces out what follows an article's body (its sources, topics, authors and comments) evenly. */
export const ArticleFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("space-y-10", className)} {...props}>
    {children}
  </div>
)
