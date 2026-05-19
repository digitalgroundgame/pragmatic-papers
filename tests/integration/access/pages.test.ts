import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Page } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"
import { ARTICLE_CONTENT } from "../fixtures/content"

const MINIMAL_PAGE = {
  hero: { type: "lowImpact" },
  layout: [
    {
      blockType: "content",
      columns: [
        {
          size: "full",
          richText: ARTICLE_CONTENT,
        },
      ],
    },
  ],
} as const

describe("pages authenticatedOrPublished access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("allows authenticated user to read a draft page", async () => {
    const member = await createUser("member")

    const draft = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    const result = await payload.findByID({
      collection: "pages",
      id: draft.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(draft.id)
  })

  it("allows authenticated user to read a published page", async () => {
    const member = await createUser("member")

    const published = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "published",
      } as unknown as Page,
    })

    const result = await payload.findByID({
      collection: "pages",
      id: published.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(published.id)
  })

  it("allows unauthenticated user to read a published page", async () => {
    const published = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Anon Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "published",
      } as unknown as Page,
    })

    const result = await payload.findByID({
      collection: "pages",
      id: published.id,
      overrideAccess: false,
      user: undefined,
    })

    expect(result.id).toBe(published.id)
  })

  it("denies unauthenticated user from reading a draft page", async () => {
    const draft = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Anon Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    await expect(
      payload.findByID({
        collection: "pages",
        id: draft.id,
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })
})
