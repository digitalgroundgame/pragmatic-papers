import type { GlobalAfterChangeHook } from "payload"

import { revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"

export const revalidateTicker: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating ticker`)
    // The posts each source returned stay cached; the hidden list is applied after them.
    revalidateTag("global_ticker", "max")
    purgeEdgeCache(payload.logger, "ticker saved")
  }

  return doc
}
