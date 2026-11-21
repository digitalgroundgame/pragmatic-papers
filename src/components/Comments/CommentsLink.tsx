import { MessageCircle } from "lucide-react"
import React from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

/**
 * Jumps to the Comments heading below an article (the `#comments` section that
 * `Comments` and `CommentsUnpublished` render). A plain anchor, so the page's
 * smooth scrolling and the section's scroll margin apply, and scrolling there
 * brings the thread close enough to load.
 */
export function CommentsLink({ className }: { className?: string }): React.ReactElement {
  return (
    <a
      href="#comments"
      aria-label="Comments"
      data-slot="button"
      className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "shrink-0", className)}
    >
      <MessageCircle aria-hidden="true" />
    </a>
  )
}
