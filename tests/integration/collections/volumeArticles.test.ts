import type { Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { createArticle, createVolume } from "../helpers/content"
import { createUser, getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/**
 * `checkArticles`, the Volumes `articles` field's validation, on a real save: a volume may hold
 * any article that has a published version, and none that has never been published.
 */
let payload: Payload
let authorId: number

beforeAll(async () => {
  payload = await getPayload()
  authorId = (await createUser("writer")).id
})

describe("a volume's articles", () => {
  it("accepts a published article with an unpublished autosave draft", async () => {
    const article = await createArticle({ authors: [authorId], title: "Published" })
    await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
      draft: true,
      autosave: true,
      data: { title: "Published, edited since" },
    })

    const volume = await createVolume({ articles: [article.id] })

    expect(volume.articles).toEqual([expect.objectContaining({ id: article.id })])
  })

  it("refuses an article that has never been published, naming it", async () => {
    const draft = await createArticle({
      authors: [authorId],
      title: "Never published",
      _status: "draft",
    })

    await expect(createVolume({ articles: [draft.id] })).rejects.toMatchObject({
      data: {
        errors: [
          {
            path: "articles",
            message: "The following articles are not published: Never published",
          },
        ],
      },
    })
  })
})
