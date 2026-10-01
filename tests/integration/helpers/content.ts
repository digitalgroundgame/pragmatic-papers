import { randomUUID } from "node:crypto"
import type { Article, Volume } from "@/payload-types"

import { ARTICLE_CONTENT } from "../fixtures/content"
import { getPayload } from "./testUsers"

/**
 * Seeds an article with revalidation off, so a test's `next/cache` mock records only what the
 * hook under test does afterwards.
 */
export async function createArticle(data: {
  authors: number[]
  _status?: Article["_status"]
  title?: string
}): Promise<Article> {
  const payload = await getPayload()
  const title = data.title ?? `Hook test article ${randomUUID().slice(0, 8)}`
  const status = data._status ?? "published"
  return payload.create({
    collection: "articles",
    overrideAccess: true,
    context: { disableRevalidate: true },
    draft: status === "draft",
    data: {
      title,
      content: ARTICLE_CONTENT,
      authors: data.authors,
      _status: status,
    } as unknown as Article,
  })
}

/** Seeds a volume, revalidation off. `volumeNumber` left out takes the next free number. */
export async function createVolume(
  data: { articles?: number[]; _status?: Volume["_status"]; volumeNumber?: number } = {},
): Promise<Volume> {
  const payload = await getPayload()
  return payload.create({
    collection: "volumes",
    overrideAccess: true,
    context: { disableRevalidate: true },
    draft: data._status === "draft",
    data: {
      title: `Hook test volume ${randomUUID().slice(0, 8)}`,
      description: "Seeded by a hook integration test",
      _status: data._status ?? "published",
      ...(data.articles ? { articles: data.articles } : {}),
      ...(data.volumeNumber !== undefined ? { volumeNumber: data.volumeNumber } : {}),
    } as unknown as Volume,
  })
}
