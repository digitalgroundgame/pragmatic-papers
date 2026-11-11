import React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/utilities/utils"

export interface BetaBadgeProps {
  className?: string
}

/**
 * Marks a feature readers can use that's still being tried out: a plugin whose switch starts
 * off (`isPluginBeta`), or an experiment. It sits beside the feature's heading, in the body
 * face, so it reads the same under any heading.
 */
export const BetaBadge: React.FC<BetaBadgeProps> = ({ className }) => (
  <Badge
    variant="outline"
    title="Still being tried out, so it may change."
    className={cn(
      "ms-2 align-middle font-sans text-xs font-medium tracking-normal normal-case",
      className,
    )}
  >
    Beta
  </Badge>
)
