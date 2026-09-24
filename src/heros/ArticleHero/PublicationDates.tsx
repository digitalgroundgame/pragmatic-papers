import { formatFullTimestamp, formatPublishedDate, revision } from "./dates"
import {
  TooltipPopup,
  TooltipPortal,
  TooltipPositioner,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
      <TooltipRoot>
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
        <TooltipPortal>
          <TooltipPositioner side="top" align="start">
            <TooltipPopup>
              {revised ? (
                <dl className="space-y-0.5">
                  <div className="flex gap-2">
                    <dt className="opacity-70">Published</dt>
                    <dd>{formatFullTimestamp(publishedAt)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="opacity-70">Updated</dt>
                    <dd>{formatFullTimestamp(revised.dateTime)}</dd>
                  </div>
                </dl>
              ) : (
                formatFullTimestamp(publishedAt)
              )}
            </TooltipPopup>
          </TooltipPositioner>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  )
}
