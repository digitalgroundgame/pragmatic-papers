import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"
import type { WhipCount } from "@/payload-types"
import { readersChange } from "@/utilities/readersCopy"

import { whipCountPath } from "../tag"

// Purged from the edge only: the page reads draftMode(), so it renders per request and Next
// holds no copy of it for revalidatePath to drop.
export const revalidateWhipCount: CollectionAfterChangeHook<WhipCount> = async (args) => {
  const { doc, req } = args
  if (req.context.disableRevalidate) return doc
  const change = await readersChange(args)
  if (!change) return doc
  const { before, after } = change
  const slugs = new Set([after?.slug, before?.slug].filter((slug): slug is string => !!slug))
  for (const slug of slugs) {
    revalidateForReaders(req.payload.logger, `whip count ${slug}`, {
      purgeOnly: [whipCountPath(slug)],
    })
  }
  return doc
}

export const revalidateWhipCountDelete: CollectionAfterDeleteHook<WhipCount> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate && doc.slug) {
    revalidateForReaders(payload.logger, `whip count ${doc.slug} deleted`, {
      purgeOnly: [whipCountPath(doc.slug)],
    })
  }
  return doc
}
