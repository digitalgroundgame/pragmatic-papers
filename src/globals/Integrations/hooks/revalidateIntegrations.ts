import type { GlobalAfterChangeHook } from "payload"

import { revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"

export const revalidateIntegrations: GlobalAfterChangeHook = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating integrations`)
    revalidateTag("global_integrations", "max")
    // A new channel or account changes what the ticker shows.
    revalidateTag("ticker", "max")
    purgeEdgeCache(payload.logger, "integrations saved")
  }

  return doc
}
