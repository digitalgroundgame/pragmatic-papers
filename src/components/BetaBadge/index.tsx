"use client"

import { FlaskConical } from "lucide-react"
import React, { useId, useState } from "react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { BetaFeature } from "@/data/betaFeatures"
import { cn } from "@/utilities/utils"

import { useBetaInfo } from "./BetaFeaturesProvider"

export { BetaFeaturesProvider } from "./BetaFeaturesProvider"

export interface BetaBadgeProps {
  /** The plugin or experiment the heading belongs to. */
  feature: BetaFeature
  className?: string
}

/**
 * A flask beside the heading of something readers can use that's still a beta: a plugin whose
 * manifest says `beta`, or an experiment whose field does. It renders nothing once the feature
 * graduates, so it can stay in place. Its tooltip says what beta means for the feature, from
 * the same note (`BetaFeaturesProvider`, which the layouts set up).
 *
 * It's a button, so keyboards reach the tooltip and a tap opens it (touch screens have no hover;
 * a tap anywhere else closes it). Screen readers hear "Beta feature", and the note as its
 * description: Base UI doesn't announce a tooltip, so the note also sits in a hidden span.
 */
export const BetaBadge: React.FC<BetaBadgeProps> = ({ feature, className }) => {
  const info = useBetaInfo(feature)
  const [open, setOpen] = useState(false)
  const descriptionId = useId()
  if (!info) return null
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          render={<button type="button" />}
          closeOnClick={false}
          onClick={() => setOpen(true)}
          aria-label="Beta feature"
          aria-describedby={descriptionId}
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 ms-2 inline-flex cursor-default items-center justify-center rounded-full p-1 align-middle transition-colors outline-none focus-visible:ring-[3px]",
            className,
          )}
        >
          <FlaskConical aria-hidden className="size-[0.55em] min-h-4 min-w-4" />
        </TooltipTrigger>
        <span id={descriptionId} hidden>
          {info}
        </span>
        <TooltipContent className="font-sans text-xs font-normal tracking-normal normal-case">
          {info}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
