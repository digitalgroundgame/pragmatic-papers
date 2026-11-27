import type { GlobalAfterChangeHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"

/** A template's layout is on every page made from it, so a save clears them all. */
export const revalidateLayouts: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info("Revalidating layouts")
    revalidateTag("global_layouts", "max")
    revalidatePath("/", "layout")
    purgeEdgeCache(payload.logger, "layouts saved")
  }
  return doc
}
