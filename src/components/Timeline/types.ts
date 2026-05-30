import type { Media, TimelineEvents } from "@/payload-types"

export type TimelineAvatar = Media

export type TimelineEvent = TimelineEvents[number]

export interface TimelineBaseProps {
  events: TimelineEvents
  title?: string | null
  className?: string
}
