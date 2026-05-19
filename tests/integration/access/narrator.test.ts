import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Article, Media } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"
import { ARTICLE_CONTENT } from "../fixtures/content"
import { MINIMAL_PNG } from "../fixtures/media"

describe("narrator access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("denies narrator from creating an article (narrator < writer)", async () => {
    const narrator = await createUser("narrator")

    await expect(
      payload.create({
        collection: "articles",
        overrideAccess: false,
        user: narrator,
        context: { disableRevalidate: true },
        data: {
          title: "Article by Narrator",
          content: ARTICLE_CONTENT,
          _status: "draft",
        } as unknown as Article,
      }),
    ).rejects.toThrow()
  })

  it("denies narrator from creating a topic (narrator < writer)", async () => {
    const narrator = await createUser("narrator")

    await expect(
      payload.create({
        collection: "topics",
        overrideAccess: false,
        user: narrator,
        draft: true,
        data: { name: "Topic by Narrator Narrator" },
      }),
    ).rejects.toThrow()
  })

  it("allows narrator to read published articles (authenticated)", async () => {
    const writerUser = await createUser("writer")
    const narrator = await createUser("narrator")

    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Article for Narrator",
        content: ARTICLE_CONTENT,
        _status: "published",
        createdBy: writerUser.id,
      } as unknown as Article,
    })

    const result = await payload.find({
      collection: "articles",
      overrideAccess: false,
      user: narrator,
      where: { id: { equals: article.id } },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0]?.id).toBe(article.id)
  })

  it("allows narrator to create media (staff gate)", async () => {
    const narrator = await createUser("narrator")

    const media = await payload.create({
      collection: "media",
      overrideAccess: false,
      user: narrator,
      data: {
        alt: "Test upload by narrator",
      } as Media,
      file: {
        data: MINIMAL_PNG,
        mimetype: "image/png",
        name: "test.png",
        size: MINIMAL_PNG.length,
      },
    })

    expect(media.id).toBeDefined()
  })
})
