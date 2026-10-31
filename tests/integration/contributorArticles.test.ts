import type { Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { Article } from "@/payload-types"
import { ARTICLE_CONTENT } from "./fixtures/content"
import { createUser, getPayload } from "./helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const draftMode = vi.hoisted(() => ({ isEnabled: false }))
vi.mock("next/headers", () => ({ draftMode: async () => draftMode }))

const { queryArticlesByAuthor } =
  await import("@/app/(frontend)/contributors/[slug]/queryArticlesByAuthor")

let payload: Payload

beforeAll(async () => {
  payload = await getPayload()
})

async function saveArticle(author: number, status: "draft" | "published"): Promise<Article> {
  return payload.create({
    collection: "articles",
    context: { disableRevalidate: true },
    draft: status === "draft",
    data: {
      title: `${status} by contributor ${Date.now()}`,
      content: ARTICLE_CONTENT,
      authors: [author],
      _status: status,
    } as unknown as Article,
  })
}

describe("contributor page articles", () => {
  it("lists only published articles to readers", async () => {
    const writer = await createUser("writer")
    const published = await saveArticle(writer.id, "published")
    await saveArticle(writer.id, "draft")

    draftMode.isEnabled = false
    const { docs, totalDocs } = await queryArticlesByAuthor(writer.id, 1)

    expect(docs.map((doc) => doc.id)).toEqual([published.id])
    expect(totalDocs).toBe(1)
  })

  it("lists drafts too in draft mode", async () => {
    const writer = await createUser("writer")
    await saveArticle(writer.id, "published")
    await saveArticle(writer.id, "draft")

    draftMode.isEnabled = true
    const { totalDocs } = await queryArticlesByAuthor(writer.id, 1)

    expect(totalDocs).toBe(2)
  })
})
