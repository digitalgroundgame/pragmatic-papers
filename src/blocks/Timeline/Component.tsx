import React from "react"

import type { TimelineBlock as Props } from "@/payload-types"

import { Timeline } from "@/components/Timeline"

interface TimelineBlockComponentProps extends Props {
  className?: string
}

export const TimelineBlock: React.FC<TimelineBlockComponentProps> = ({
  events,
  title,
  className,
  description,
}) => {
  return (
    <div role={description ? "region" : undefined} aria-label={description ?? undefined}>
      <Timeline events={events ?? []} title={title} className={className} />
    </div>
  )
}
