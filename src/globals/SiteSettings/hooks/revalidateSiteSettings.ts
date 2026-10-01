import type { GlobalAfterChangeHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"

export const revalidateSiteSettings: GlobalAfterChangeHook = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating site settings`)
    revalidateTag("global_site-settings", "max")
    revalidatePath("/", "layout")
    // An experiment switch decides whether whole routes 404 and which links render, so
    // Cloudflare's cached copies are wrong the moment it flips (#1054).
    purgeEdgeCache(payload.logger, "site settings saved")
  }

  return doc
}
