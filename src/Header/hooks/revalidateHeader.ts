import type { GlobalAfterChangeHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { TICKER_SETTINGS_TAG } from "@/components/Ticker/items"
import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Header } from "@/payload-types"

/**
 * The ticker's settings that only `/api/ticker` reads: which posts are hidden, and how far
 * ahead a scheduled stream shows. Pages render the ticker's switch alone.
 */
const FEED_ONLY_FIELDS = ["hidden", "upcomingHours"] as const

/** The header as pages render it: everything but the feed-only ticker settings and the stamps. */
function asPagesRenderIt(doc: Partial<Header> | undefined): string {
  if (!doc) return ""
  const { updatedAt: _updatedAt, createdAt: _createdAt, ticker, ...rest } = doc
  const pageTicker = { ...ticker }
  for (const field of FEED_ONLY_FIELDS) delete pageTicker[field]
  return JSON.stringify({ ...rest, ticker: pageTicker })
}

/**
 * Whether a save changed only what the ticker's feed reads, such as an editor hiding a post.
 * That reaches readers through `/api/ticker` within its minute at the edge, so no page needs
 * clearing.
 */
export function onlyTickerFeedChanged(
  doc: Partial<Header>,
  previousDoc: Partial<Header> | undefined,
): boolean {
  return previousDoc !== undefined && asPagesRenderIt(doc) === asPagesRenderIt(previousDoc)
}

export const revalidateHeader: GlobalAfterChangeHook = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    // At once, so the admin's list of posts shows the change as soon as the save returns.
    revalidateTag(TICKER_SETTINGS_TAG, { expire: 0 })
    if (onlyTickerFeedChanged(doc as Header, previousDoc as Header | undefined)) {
      payload.logger.info(`Revalidating the ticker's feed`)
      return doc
    }
    payload.logger.info(`Revalidating header`)
    revalidateTag("global_header", "max")
    revalidatePath("/", "layout")
    purgeEdgeCache(payload.logger, "header saved")
  }

  return doc
}
