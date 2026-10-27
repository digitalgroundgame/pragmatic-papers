import { formatPublishedDate } from "@/heros/ArticleHero/dates"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/** `YYYY-MM-DD` of a doc's date, which is a day (stored as midnight UTC) rather than an instant. */
const day = (date: string): string => date.slice(0, 10)

/** "Oct. 9, 2026", as articles show their dates. Noon UTC is the same day in every US zone. */
const shortDate = (date: string): string => formatPublishedDate(`${day(date)}T12:00:00Z`)

/** "Friday, October 9, 2026": the tooltip's spelled-out day. */
const fullDate = (date: string): string =>
  new Date(`${day(date)}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })

interface DocDatesProps {
  publishedAt: string
  revisedAt?: string | null
}

/**
 * A doc's dateline, shaped like an article's: the published day, then "Updated" and the day it
 * last changed, with both spelled out in a tooltip. Days only: a doc's dates carry no time.
 */
export function DocDates({ publishedAt, revisedAt }: DocDatesProps): React.ReactNode {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<span />}
          // Base UI derives the id from render order otherwise.
          id="doc-dateline"
          tabIndex={0}
          className="text-foreground cursor-default font-serif underline-offset-4 hover:underline hover:decoration-dotted"
        >
          <time dateTime={day(publishedAt)}>{shortDate(publishedAt)}</time>
          {revisedAt && (
            <time dateTime={day(revisedAt)} className="text-muted-foreground ml-2">
              Updated {shortDate(revisedAt)}
            </time>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <dl className="space-y-0.5">
            <div className="flex gap-2">
              <dt className="opacity-70">Published</dt>
              <dd>{fullDate(publishedAt)}</dd>
            </div>
            {revisedAt && (
              <div className="flex gap-2">
                <dt className="opacity-70">Updated</dt>
                <dd>{fullDate(revisedAt)}</dd>
              </div>
            )}
          </dl>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
