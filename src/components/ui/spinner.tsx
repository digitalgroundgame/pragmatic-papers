import { Loader2Icon } from "lucide-react"
import * as React from "react"

import { cn } from "@/utilities/utils"

/**
 * shadcn's Spinner: a turning loader that says "Loading" to screen readers. Pass
 * `aria-hidden` where something else already announces the wait.
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">): React.ReactNode {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
