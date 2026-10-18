import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"
import type { Doc } from "@/payload-types"
import { readersChange } from "@/utilities/readersCopy"

/** The cache tag on every published-docs read: the /docs pages and the help bell. */
export const DOCS_CACHE_TAG = "docs"

/**
 * A doc save revalidates /docs, its own pages and the `docs` tag, and the Worker purges every
 * page under /docs (purging `/docs` takes them all), since each one's sidebar and Previous and
 * Next links read every published doc.
 */
const revalidate = (
  logger: Parameters<typeof revalidateForReaders>[0],
  reason: string,
  slugs: (string | null | undefined)[],
): void => {
  revalidateForReaders(logger, reason, {
    paths: ["/docs", ...slugs.filter(Boolean).map((slug) => `/docs/${slug}`)],
    tags: [DOCS_CACHE_TAG],
  })
}

/** Revalidates every page under /docs: their sidebars read every doc and section. */
export const revalidateDocs = (
  logger: Parameters<typeof revalidateForReaders>[0],
  reason: string,
): void => revalidate(logger, reason, [])

export const revalidateDoc: CollectionAfterChangeHook<Doc> = async (args) => {
  const { doc, req } = args
  if (req.context.disableRevalidate) return doc
  const change = await readersChange(args)
  if (!change) return doc
  const { before } = change
  const renamed = before?.slug && before.slug !== doc.slug ? before.slug : null
  revalidate(req.payload.logger, `doc ${doc.slug}`, [doc.slug, renamed])
  return doc
}

export const revalidateDocDelete: CollectionAfterDeleteHook<Doc> = ({
  doc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  revalidate(payload.logger, `doc ${doc?.slug} deleted`, [doc?.slug])
  return doc
}
