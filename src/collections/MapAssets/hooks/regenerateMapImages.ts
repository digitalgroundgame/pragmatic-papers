import type { CollectionAfterChangeHook } from "payload"

import { generateMapImages, mapBlocksIn } from "@/blocks/InteractiveMap/feedImage"
import { revalidateForReaders } from "@/hooks/revalidateForReaders"
import type { MapAsset } from "@/payload-types"
import { relationshipId } from "@/utilities/relationships"

const PAGE_SIZE = 100

/**
 * A map whose SVG was replaced looks different in every published article that uses it, so
 * their feed pictures are drawn again (`generateBlockImages` draws them when an article is
 * published). Blocks inside rich text can't be queried for, so this reads each published
 * article once. The Substack feeds of the articles redrawn are cached, so they're revalidated
 * to name the new pictures. Failing here never fails the save.
 */
export const regenerateMapImages: CollectionAfterChangeHook<MapAsset> = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (operation !== "update" || doc.svgContent === previousDoc?.svgContent) return doc

  const redrawn: string[] = []
  try {
    for (let page = 1; ; page++) {
      const articles = await req.payload.find({
        collection: "articles",
        where: { _status: { equals: "published" } },
        select: { slug: true, content: true },
        depth: 0,
        limit: PAGE_SIZE,
        page,
        overrideAccess: true,
        req,
      })
      const blocks = articles.docs.flatMap(({ slug, content }) => {
        const using = mapBlocksIn(content).filter((block) =>
          (block.maps ?? []).some((map) => relationshipId(map.svgAsset) === doc.id),
        )
        if (using.length && slug) redrawn.push(slug)
        return using
      })
      await generateMapImages({ blocks, req, assets: [doc] })
      if (!articles.hasNextPage) break
    }
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: `Could not render the images of the articles using map ${doc.id}`,
    })
  }
  if (redrawn.length && !req.context?.disableRevalidate) {
    revalidateForReaders(req.payload.logger, `map ${doc.id}`, {
      paths: ["/articles/substack.xml", ...redrawn.map((slug) => `/articles/${slug}/substack.xml`)],
    })
  }
  return doc
}
