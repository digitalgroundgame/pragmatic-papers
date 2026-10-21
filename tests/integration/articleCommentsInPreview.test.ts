import type { Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { Article } from "@/payload-types"
import { ARTICLE_CONTENT } from "./fixtures/content"
import { getPayload } from "./helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { isArticlePublished } = await import("@/app/(frontend)/articles/[slug]/isArticlePublished")

let payload: Payload

beforeAll(async () => {
  payload = await getPayload()
})

async function saveArticle(status: "draft" | "published"): Promise<Article> {
  return payload.create({
    collection: "articles",
    context: { disableRevalidate: true },
    draft: status === "draft",
    data: {
      title: `${status} for preview comments ${Date.now()}`,
      content: ARTICLE_CONTENT,
      _status: status,
    } as unknown as Article,
  })
}

describe("comments in preview", () => {
  it("keeps comments on a published article", async () => {
    const article = await saveArticle("published")

    expect(await isArticlePublished(article.id)).toBe(true)
  })

  it("keeps them while a newer draft is being previewed", async () => {
    const article = await saveArticle("published")
    await payload.update({
      collection: "articles",
      id: article.id,
      draft: true,
      context: { disableRevalidate: true },
      data: { title: "An unpublished rewrite" },
    })

    expect(await isArticlePublished(article.id)).toBe(true)
  })

  it("leaves them off an article that was never published", async () => {
    const article = await saveArticle("draft")

    expect(await isArticlePublished(article.id)).toBe(false)
  })
})
