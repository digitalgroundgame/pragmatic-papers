import type { GlobalAfterChangeHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"

export const revalidatePlugins: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating plugins`)
    revalidateTag("global_plugins", "max")
    revalidatePath("/", "layout")
    // A plugin's switch decides whether whole routes 404 (the help docs), so Cloudflare's
    // cached copies are wrong the moment it flips.
    purgeEdgeCache(payload.logger, "plugin switches saved")
  }

  return doc
}
