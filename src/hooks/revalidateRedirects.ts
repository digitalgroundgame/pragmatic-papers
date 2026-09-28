import type { CollectionAfterChangeHook } from "payload"

import { revalidateTag } from "next/cache"

export const revalidateRedirects: CollectionAfterChangeHook = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating redirects`)
    revalidateTag("redirects", "max")
  }

  return doc
}
