import type { CollectionAfterChangeHook } from "payload"

import { revalidateTag } from "next/cache"

import { purgeEdgeCache } from "./purgeEdgeCache"

export const revalidateRedirects: CollectionAfterChangeHook = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating redirects`)
    revalidateTag("redirects", "max")
    purgeEdgeCache(payload.logger, "redirects changed")
  }

  return doc
}
