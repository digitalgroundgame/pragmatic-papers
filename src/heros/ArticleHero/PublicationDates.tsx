import { formatFullDate, formatPublishedDate, formatTimeOfDay, revision } from "./dates"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * "Wednesday, August 20, 2026 at 6:56 p.m. ET". Where the screen is too narrow
 * for one line, it breaks before the time, never inside it, so "ET" stays put.
 */
function FullTimestamp({ timestamp }: { timestamp: string }): React.ReactNode {
  return (
    <>
      {formatFullDate(timestamp)} at{" "}
      <span data-slot="time-of-day" className="whitespace-nowrap">
        {formatTimeOfDay(timestamp)}
      </span>
    </>
  )
}

interface PublicationDatesProps {
  publishedAt: string | null | undefined
  updatedAt: string
}

/**
 * The dateline. Not a link — this is the page the link would go to — so the
 * dates keep their `<time>` semantics and the tooltip carries the full
 * instants, letting the visible stamp stay as short as a newspaper's.
 */
export function PublicationDates({
  publishedAt,
  updatedAt,
}: PublicationDatesProps): React.ReactNode {
  if (!publishedAt) return null
  const revised = revision(publishedAt, updatedAt)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<span />}
          // Base UI derives the id from render order otherwise, which makes it
          // shift under any test that renders before this one.
          id="article-dateline"
          tabIndex={0}
          className="text-foreground cursor-default font-serif underline-offset-4 hover:underline hover:decoration-dotted"
        >
          <time dateTime={publishedAt}>{formatPublishedDate(publishedAt)}</time>
          {revised && (
            <>
              <time dateTime={revised.dateTime} className="text-muted-foreground ml-2">
                {revised.label}
              </time>
            </>
          )}
        </TooltipTrigger>
        {/* Wide enough for the longest stamp (a Wednesday in September at 12:59 p.m.)
            on one line, and never wider than the screen. */}
        <TooltipContent side="top" align="start" className="max-w-[calc(100vw-1rem)]">
          {revised ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <dt className="opacity-70">Published</dt>
              <dd>
                <FullTimestamp timestamp={publishedAt} />
              </dd>
              <dt className="opacity-70">Updated</dt>
              <dd>
                <FullTimestamp timestamp={revised.dateTime} />
              </dd>
            </dl>
          ) : (
            <span>
              <FullTimestamp timestamp={publishedAt} />
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
