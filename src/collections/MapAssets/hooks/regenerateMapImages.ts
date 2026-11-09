import type { CollectionAfterChangeHook } from "payload"

import { generateMapImages, mapBlocksIn } from "@/blocks/InteractiveMap/feedImage"
import type { MapAsset } from "@/payload-types"
import { relationshipId } from "@/utilities/relationships"

const PAGE_SIZE = 100

/**
 * A map whose SVG was replaced looks different in every published article that uses it, so
 * their feed pictures are drawn again (`generateBlockImages` draws them when an article is
 * published). Blocks inside rich text can't be queried for, so this reads each published
 * article once. Failing here never fails the save.
 */
export const regenerateMapImages: CollectionAfterChangeHook<MapAsset> = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (operation !== "update" || doc.svgContent === previousDoc?.svgContent) return doc

  try {
    for (let page = 1; ; page++) {
      const articles = await req.payload.find({
        collection: "articles",
        where: { _status: { equals: "published" } },
        select: { content: true },
        depth: 0,
        limit: PAGE_SIZE,
        page,
        overrideAccess: true,
        req,
      })
      const blocks = articles.docs
        .flatMap(({ content }) => mapBlocksIn(content))
        .filter((block) =>
          (block.maps ?? []).some((map) => relationshipId(map.svgAsset) === doc.id),
        )
      await generateMapImages({ blocks, req, assets: [doc] })
      if (!articles.hasNextPage) break
    }
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Could not render the images of the articles using map ${doc.id}`,
    })
  }
  return doc
}
