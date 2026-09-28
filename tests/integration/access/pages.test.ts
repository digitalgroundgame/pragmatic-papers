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

describe("pages isPublishedOrStaff access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("allows staff user to read a draft page", async () => {
    const editor = await createUser("editor")

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
      user: editor,
    })

    expect(result.id).toBe(draft.id)
  })

  it("denies member user from reading a draft page", async () => {
    const member = await createUser("member")

    const draft = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Page AoP - pages member read",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    await expect(
      payload.findByID({
        collection: "pages",
        id: draft.id,
        overrideAccess: false,
        user: member,
      }),
    ).rejects.toThrow()
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

  it("allows staff user to find both draft and published pages", async () => {
    const editor = await createUser("editor")

    const draft = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    const published = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "published",
      } as unknown as Page,
    })

    const result = await payload.find({
      collection: "pages",
      overrideAccess: false,
      user: editor,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(2)
    expect(result.docs.map((d) => d.id)).toEqual(expect.arrayContaining([draft.id, published.id]))
  })

  it("filters draft pages for member user find", async () => {
    const member = await createUser("member")

    const draft = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Member Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    const published = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Member Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "published",
      } as unknown as Page,
    })

    const result = await payload.find({
      collection: "pages",
      overrideAccess: false,
      user: member,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs.map((d) => d.id)).toEqual([published.id])
  })

  it("filters draft pages for unauthenticated user find", async () => {
    const draft = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Anon Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    const published = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Anon Page AoP - pages",
        ...MINIMAL_PAGE,
        _status: "published",
      } as unknown as Page,
    })

    const result = await payload.find({
      collection: "pages",
      overrideAccess: false,
      user: undefined,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs.map((d) => d.id)).toEqual([published.id])
  })

  it("denies unauthenticated user from creating a page", async () => {
    await expect(
      payload.create({
        collection: "pages",
        overrideAccess: false,
        context: { disableRevalidate: true },
        data: {
          title: "Unauthenticated Create Page - pages",
          ...MINIMAL_PAGE,
          _status: "draft",
        } as unknown as Page,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated user from updating a page", async () => {
    const page = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Unauthenticated Update Page - pages",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    await expect(
      payload.update({
        collection: "pages",
        id: page.id,
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
        data: { title: "Should Not Update" },
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated user from deleting a page", async () => {
    const page = await payload.create({
      collection: "pages",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Unauthenticated Delete Page - pages",
        ...MINIMAL_PAGE,
        _status: "draft",
      } as unknown as Page,
    })

    await expect(
      payload.delete({
        collection: "pages",
        id: page.id,
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow()
  })
})
