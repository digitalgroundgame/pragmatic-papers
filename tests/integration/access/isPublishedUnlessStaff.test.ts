import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Article } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"
import { ARTICLE_CONTENT } from "../fixtures/content"

describe("isPublishedUnlessStaff access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("denies unauthenticated user from creating an article", async () => {
    await expect(
      payload.create({
        collection: "articles",
        overrideAccess: false,
        context: { disableRevalidate: true },
        data: {
          title: "Unauthenticated Create",
          content: ARTICLE_CONTENT,
          _status: "draft",
        } as unknown as Article,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it("allows staff user to read a draft article", async () => {
    const writer = await createUser("writer")
    const narrator = await createUser("narrator")

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Article AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
      user: writer,
    })

    const result = await payload.findByID({
      collection: "articles",
      id: draft.id,
      overrideAccess: false,
      user: narrator,
    })

    expect(result.id).toBe(draft.id)
  })

  it("denies member user from reading a draft article", async () => {
    const member = await createUser("member")
    const writer = await createUser("writer")

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Article AoP - aop member read",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
      user: writer,
    })

    await expect(
      payload.findByID({
        collection: "articles",
        id: draft.id,
        overrideAccess: false,
        user: member,
      }),
    ).rejects.toThrow()
  })

  it("allows authenticated user to read a published article", async () => {
    const member = await createUser("member")

    const published = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Article AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })

    const result = await payload.findByID({
      collection: "articles",
      id: published.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(published.id)
  })

  it("allows unauthenticated user to read a published article", async () => {
    const published = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Anon AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })

    const result = await payload.findByID({
      collection: "articles",
      id: published.id,
      overrideAccess: false,
      user: undefined,
    })

    expect(result.id).toBe(published.id)
  })

  it("denies unauthenticated user from reading a draft article", async () => {
    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Anon AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    await expect(
      payload.findByID({
        collection: "articles",
        id: draft.id,
        overrideAccess: false,
        user: undefined,
      }),
    ).rejects.toThrow()
  })

  it("allows staff user to find both draft and published articles", async () => {
    const narrator = await createUser("narrator")

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    const published = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })

    const result = await payload.find({
      collection: "articles",
      overrideAccess: false,
      user: narrator,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(2)
    expect(result.docs.map((d) => d.id)).toEqual(expect.arrayContaining([draft.id, published.id]))
  })

  it("filters draft articles for member user find", async () => {
    const member = await createUser("member")

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Member AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    const published = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Member AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })

    const result = await payload.find({
      collection: "articles",
      overrideAccess: false,
      user: member,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs.map((d) => d.id)).toEqual([published.id])
  })

  it("filters draft articles for unauthenticated user find", async () => {
    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Find Anon AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    const published = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Find Anon AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "published",
      } as unknown as Article,
    })

    const result = await payload.find({
      collection: "articles",
      overrideAccess: false,
      user: undefined,
      where: {
        id: { in: [draft.id, published.id] },
      },
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs.map((d) => d.id)).toEqual([published.id])
  })

  it("denies unauthenticated user from updating an article", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Unauthenticated Update AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    await expect(
      payload.update({
        collection: "articles",
        id: article.id,
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
        data: { title: "Should Not Update" },
      }),
    ).rejects.toThrow()
  })

  it("denies unauthenticated user from deleting an article", async () => {
    const article = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Unauthenticated Delete AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      } as unknown as Article,
    })

    await expect(
      payload.delete({
        collection: "articles",
        id: article.id,
        overrideAccess: false,
        user: undefined,
        context: { disableRevalidate: true },
      }),
    ).rejects.toThrow()
  })
})
