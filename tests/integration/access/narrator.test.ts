import { describe, expect, it, beforeAll, afterAll } from "vitest"
import type { Payload } from "payload"
import type { Article } from "@/payload-types"
import { getPayload, createUser, destroyPayload } from "../helpers/testUsers"
import { ARTICLE_CONTENT } from "../fixtures/content"

describe("narrator access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  afterAll(async () => {
    await destroyPayload()
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
})
