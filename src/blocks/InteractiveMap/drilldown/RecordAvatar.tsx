"use client"

import React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/utilities/utils"

import { categoryOf, fieldString, initials, isSupernumerary } from "./recordFormat"
import type { DrilldownRecord, RecordDisplay } from "./types"

interface RecordAvatarProps {
  record: DrilldownRecord
  display: RecordDisplay
  /** `bench` on a wide stage, `compact` on a narrow one, `chip` inline, `detail` in the card. */
  size?: "bench" | "compact" | "chip" | "detail"
  marked?: boolean
  className?: string
}

/**
 * Face (or initials) ringed in the record's category colour. The image is a plain hotlink
 * with a fallback — deliberately not the Next image optimiser, so an archived page still
 * shows initials when the remote host is gone rather than a broken proxy request.
 */
export function RecordAvatar({
  record,
  display,
  size = "bench",
  marked = false,
  className,
}: RecordAvatarProps): React.ReactElement {
  const name = fieldString(record, display.title) ?? "?"
  const url = fieldString(record, display.image?.url)
  const category = categoryOf(record, display)
  const muted = isSupernumerary(record, display)
  return (
    <Avatar
      data-drilldown-avatar=""
      data-muted={muted ? "" : undefined}
      data-marked={marked ? "" : undefined}
      className={cn(
        "bg-muted border-[3px] after:hidden",
        size === "bench" && "size-11 text-sm",
        size === "compact" && "size-9 border-[2.5px] text-xs",
        size === "chip" && "size-8 text-xs",
        size === "detail" && "size-20 text-xl",
        muted && "opacity-70 grayscale",
        marked && "border-dashed",
        className,
      )}
      style={{ borderColor: category.color }}
    >
      {url && <AvatarImage src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" />}
      <AvatarFallback className="bg-muted text-foreground font-sans font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
