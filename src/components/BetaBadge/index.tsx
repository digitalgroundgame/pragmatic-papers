"use client"

import { FlaskConical } from "lucide-react"
import React, { useState } from "react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/utilities/utils"

export interface BetaBadgeProps {
  /** What the tooltip says about the feature. */
  info?: string
  className?: string
}

const DEFAULT_INFO = "In beta: we're still trying this out, so it may change."

/**
 * Marks a feature readers can use that's still being tried out: a plugin whose switch starts
 * off (`isPluginBeta`), or an experiment. A flask beside the feature's heading, sized to it,
 * whose tooltip says so. It's a button so keyboards reach the tooltip, and its label reads
 * "Beta feature" to screen readers, which then hear the tooltip as its description. A tap opens it
 * too, since touch screens have no hover, and a tap anywhere else closes it.
 */
export const BetaBadge: React.FC<BetaBadgeProps> = ({ info = DEFAULT_INFO, className }) => {
  const [open, setOpen] = useState(false)
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          render={<button type="button" />}
          closeOnClick={false}
          onClick={() => setOpen(true)}
          aria-label="Beta feature"
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 ms-2 inline-flex cursor-default items-center justify-center rounded-full p-1 align-middle transition-colors outline-none focus-visible:ring-[3px]",
            className,
          )}
        >
          <FlaskConical aria-hidden className="size-[0.55em] min-h-4 min-w-4" />
        </TooltipTrigger>
        <TooltipContent className="font-sans text-xs font-normal tracking-normal normal-case">
          {info}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
