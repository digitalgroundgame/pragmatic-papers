/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

const ARTICLE_CONTENT = {
  root: {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [{ type: "text", text: "Test content" }],
        direction: null,
        format: "",
      },
    ],
    direction: null,
    format: "",
  },
}

describe("narrator access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  it("denies narrator from creating an article (narrator < writer)", async () => {
    const narrator = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "narrator-create-article@example.com",
        password: "test-password",
        name: "Narrator Create Article",
        role: "narrator",
      },
    } as any)

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
        },
      } as any),
    ).rejects.toThrow()
  })

  it("denies narrator from creating a topic (narrator < writer)", async () => {
    const narrator = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "narrator-create-topic-narrator@example.com",
        password: "test-password",
        name: "Narrator Create Topic Narrator",
        role: "narrator",
      },
    } as any)

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
