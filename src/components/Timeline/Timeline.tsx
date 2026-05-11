import { CMSLink } from "@/components/Link/CMSLink2"
import { getLinkFieldUrl } from "@/utilities/getLinkFieldUrl"
import { cn } from "@/utilities/utils"

import { Media } from "@/components/Media"
import { Separator } from "@/components/ui/separator"
import { TimelineEventReveal } from "./TimelineEventReveal"
import type { TimelineAvatar, TimelineBaseProps, TimelineEvent } from "./types"

const Citation: React.FC<Pick<TimelineEvent, "date" | "enableCitation" | "citation">> = ({
  date,
  enableCitation,
  citation,
}) => {
  if (!enableCitation || !citation || !getLinkFieldUrl(citation)) return null
  return (
    <CMSLink
      link={citation}
      className={cn(
        "text-brand dark:text-brand-high-contrast hover:text-foreground ml-1 text-sm transition-colors",
      )}
      aria-label={`Citation for ${date}`}
    />
  )
}

const Avatar: React.FC<{ media: TimelineAvatar }> = ({ media }) => (
  <Media
    media={media}
    variant="thumbnail"
    sizes="64px"
    className="size-16 shrink-0 rounded-full border object-cover"
  />
)

const EventContent: React.FC<{
  event: TimelineEvent
  isLeft: boolean
}> = ({ event, isLeft }) => (
  <div
    className={cn("flex items-center gap-3 md:basis-1/2", isLeft ? "justify-start" : "justify-end")}
  >
    {typeof event.avatar === "object" && event.avatar ? (
      <Avatar media={event.avatar} />
    ) : (
      <div className="size-16" />
    )}
    <div className={cn("w-full max-w-[240px]", isLeft ? "text-right" : "order-first")}>
      <div className="text-brand dark:text-brand-high-contrast text-sm font-bold tracking-wide">
        {new Date(event.date).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      {event.title && <div>{event.title}</div>}
      <p className={cn("text-muted-foreground text-sm text-pretty")}>
        {event.description}
        <Citation
          date={event.date}
          enableCitation={event.enableCitation}
          citation={event.citation}
        />
      </p>
    </div>
  </div>
)

export const Timeline: React.FC<TimelineBaseProps> = ({ events, title, className }) => {
  return (
    <div className={cn("prose-p:my-0 prose-img:my-0 w-full", className)}>
      {title && <h3>{title}</h3>}
      <div className="relative space-y-12 border-t border-b py-6 md:space-y-6 lg:-mx-8 xl:-mx-16">
        <Separator
          orientation="vertical"
          className="absolute top-0 left-0 h-full -translate-x-1/2 md:left-1/2"
        />
        {events.map((event, index) => {
          const isLeft = index % 2 === 0
          return (
            <TimelineEventReveal key={index} className={cn("relative px-2")}>
              <EventContent event={event} isLeft={isLeft} />
              <div
                className={cn(
                  "absolute top-1 left-0 z-10 h-3 w-3 -translate-x-1/2 rounded-full md:left-1/2",
                  isLeft ? "bg-brand dark:text-brand-high-contrast" : "bg-foreground",
                )}
              />
            </TimelineEventReveal>
          )
        })}
      </div>
    </div>
  )
}
