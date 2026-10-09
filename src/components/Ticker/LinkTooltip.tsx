"use client"

import { useState } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { LinkIcon } from "./LinkIcon"

/**
 * A link icon whose tooltip shows the full URL. `pointed` says the pointer was already on the
 * icon when it loaded, so it opens at once rather than waiting for a move.
 */
export function LinkTooltip({
  url,
  pointed = false,
}: {
  url: string
  pointed?: boolean
}): React.ReactNode {
  const [open, setOpen] = useState(pointed)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger delay={150} render={<LinkIcon url={url} />} />
      <TooltipContent className="max-w-[min(32rem,90vw)] break-all">{url}</TooltipContent>
    </Tooltip>
  )
}
