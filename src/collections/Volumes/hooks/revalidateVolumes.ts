import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"
import type { Article, Volume } from "@/payload-types"
import { readersChange } from "@/utilities/readersCopy"

const revalidateVolume = (slug: string | null | undefined, payload: Payload, why: string) => {
  revalidateForReaders(payload.logger, `volume ${slug}${why}`, {
    paths: [`/volumes/${slug}`, "/volumes/feed.xml"],
    tags: ["volumes-sitemap"],
    shared: true,
  })
}

export const revalidateArticle: CollectionAfterChangeHook<Volume> = async (args) => {
  const { doc, req } = args
  if (req.context.disableRevalidate) return doc
  const change = await readersChange(args)
  if (!change) return doc
  const { before, after } = change
  if (after) revalidateVolume(after.slug, req.payload, "")
  if (before && (!after || before.slug !== after.slug)) {
    revalidateVolume(before.slug, req.payload, after ? " renamed" : " unpublished")
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Article> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) revalidateVolume(doc?.slug, payload, " deleted")

  return doc
}
