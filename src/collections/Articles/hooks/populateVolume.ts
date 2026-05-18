import type { Article } from "@/payload-types"
import type { CollectionAfterReadHook } from "payload"

export const populateVolume: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead || context.skipPopulateVolume) return doc
  if (!doc.id) return doc

  try {
    const result = await payload.find({
      collection: "volumes",
      where: { articles: { contains: doc.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const volume = result.docs?.[0]
    if (!volume) return doc

    doc.populatedVolume = {
      id: volume.id,
      slug: volume.slug ?? undefined,
      volumeNumber: volume.volumeNumber ?? undefined,
      title: volume.title ?? undefined,
      publishedAt: volume.publishedAt ?? undefined,
    }
  } catch (error) {
    payload.logger.error({ err: error, articleId: doc.id }, "Failed to populate volume")
  }

  return doc
}
