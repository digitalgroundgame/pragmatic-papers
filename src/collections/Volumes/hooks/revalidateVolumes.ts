import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Article, Volume } from "@/payload-types"
import { readersChange } from "@/utilities/readersCopy"

const revalidateVolume = (slug: string | null | undefined, payload: Payload, why: string) => {
  const path = `/volumes/${slug}`
  payload.logger.info(`Revalidating volume at path: ${path}`)
  revalidatePath(path)
  revalidatePath("/volumes/feed.xml")
  revalidateTag("volumes-sitemap", "max")
  purgeEdgeCache(payload.logger, `volume ${slug}${why}`, {
    paths: [path, "/volumes/feed.xml"],
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
  if (!context.disableRevalidate) {
    const path = `/volumes/${doc?.slug}`

    revalidatePath(path)
    revalidatePath("/volumes/feed.xml")
    revalidateTag("volumes-sitemap", "max")
    purgeEdgeCache(payload.logger, `volume ${doc?.slug} deleted`, {
      paths: [path, "/volumes/feed.xml"],
      shared: true,
    })
  }

  return doc
}
