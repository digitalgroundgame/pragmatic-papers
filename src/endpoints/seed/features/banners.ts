import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createArticle, validateWriters } from "../articles"
import {
  createHeadingNode,
  createParagraph,
  createRichText,
  createRichTextContent,
} from "../richtext"

const createBannerBlock = (style: "info" | "warning" | "error" | "success", message: string) => ({
  type: "block",
  fields: {
    blockType: "banner",
    style,
    content: createRichTextContent(message),
  },
  format: "",
  version: 2,
})

export const createBannerBlocksArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  validateWriters(writers)

  const writer = writers[0]!
  const title = "Banners - Editorial Notices in Context"

  const article = await createArticle(payload, {
    title,
    content: createRichText([
      createParagraph(
        "Banners give editors a consistent way to surface contextual notes inside long-form articles. The examples below cover the available styles.",
      ),
      createHeadingNode("Info", "h2"),
      createBannerBlock(
        "info",
        "Use an info banner for neutral context, definitions, or editorial notes.",
      ),
      createHeadingNode("Warning", "h2"),
      createBannerBlock(
        "warning",
        "Use a warning banner when a section needs careful interpretation or extra caution.",
      ),
      createHeadingNode("Error", "h2"),
      createBannerBlock(
        "error",
        "Use an error banner for corrections, invalid assumptions, or deprecated claims.",
      ),
      createHeadingNode("Success", "h2"),
      createBannerBlock(
        "success",
        "Use a success banner for completed steps, confirmed findings, or positive outcomes.",
      ),
      createParagraph(
        "Together these variants provide a compact visual vocabulary for article-level editorial guidance.",
      ),
    ]),
    authors: [writer.id],
    topics,
    slug: "banners-editorial-notices-in-context",
    heroImage: mediaDocs[0]?.id,
    meta: {
      title,
      description: "A seeded article demonstrating Banners.",
      image: mediaDocs[0]?.id,
    },
  })

  return article.id
}
