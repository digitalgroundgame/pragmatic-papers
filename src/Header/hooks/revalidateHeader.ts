import type { GlobalAfterChangeHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating header`)
    revalidateTag("global_header", "max")
    revalidatePath("/", "layout")
    purgeEdgeCache(payload.logger, "header saved")
  }

  return doc
}
