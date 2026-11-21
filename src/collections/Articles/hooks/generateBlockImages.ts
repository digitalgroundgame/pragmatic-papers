import type { CollectionAfterChangeHook, PayloadRequest } from "payload"

import { generateMapImages, mapBlocksIn } from "@/blocks/InteractiveMap/feedImage"
import type { Article } from "@/payload-types"

/**
 * Blocks a feed shows as a picture, and what draws and stores each one's. Only maps: a
 * timeline is text and links, which a picture would make unselectable and unreadable to a
 * screen reader, so it stays HTML.
 */
const IMAGE_GENERATORS: Record<string, (content: unknown, req: PayloadRequest) => Promise<void>> = {
  interactiveMap: (content, req) => generateMapImages({ blocks: mapBlocksIn(content), req }),
}

/**
 * Draws the picture the Substack feed shows in place of each block that can't run there,
 * when the article is published rather than when a feed is built, so a feed never renders
 * images. A block whose picture exists is left alone. Failing here never fails the save:
 * the feed links to the article for a block with no picture.
 */
export const generateBlockImages: CollectionAfterChangeHook<Article> = async ({ doc, req }) => {
  if (doc._status !== "published") return doc

  for (const [slug, generate] of Object.entries(IMAGE_GENERATORS)) {
    try {
      await generate(doc.content, req)
    } catch (error) {
      req.payload.logger.error({
        err: error,
        msg: `Could not render the ${slug} images of article ${doc.id}`,
      })
    }
  }
  return doc
}
