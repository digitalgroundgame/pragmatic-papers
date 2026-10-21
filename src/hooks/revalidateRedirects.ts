import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import type { Redirect } from "@/payload-types"

import { revalidateForReaders } from "./revalidateForReaders"

// A redirect changes only what its `from` path serves, so the edge purges that path rather
// than every page. The `redirects` tag clears each cached page that read the list.
export const revalidateRedirects: CollectionAfterChangeHook<Redirect> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    revalidateForReaders(payload.logger, "redirects changed", {
      tags: ["redirects"],
      purgeOnly: [doc.from, previousDoc?.from !== doc.from ? previousDoc?.from : null],
    })
  }

  return doc
}

export const revalidateRedirectsDelete: CollectionAfterDeleteHook<Redirect> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    revalidateForReaders(payload.logger, "redirect deleted", {
      tags: ["redirects"],
      purgeOnly: [doc.from],
    })
  }

  return doc
}
