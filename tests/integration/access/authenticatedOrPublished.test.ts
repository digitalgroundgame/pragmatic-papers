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

describe("authenticatedOrPublished access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  it("allows authenticated user to read a draft article", async () => {
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-aop-aop@example.com",
        password: "test-password",
        name: "Member AoP - aop",
        role: "member",
      },
    } as any)

    const writer = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "writer-aop-aop@example.com",
        password: "test-password",
        name: "Writer AoP - aop",
        role: "writer",
      },
    } as any)

    const draft = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Draft Article AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "draft",
      },
      user: writer,
    } as any)

    const result = await payload.findByID({
      collection: "articles",
      id: draft.id,
      overrideAccess: false,
      user: member,
    })

    expect(result.id).toBe(draft.id)
  })

  it("allows authenticated user to read a published article", async () => {
    const member = await payload.create({
      collection: "users",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        email: "member-pub-aop@example.com",
        password: "test-password",
        name: "Member Pub - aop",
        role: "member",
      },
    } as any)

    const published = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: {
        title: "Published Article AoP - aop",
        content: ARTICLE_CONTENT,
        _status: "published",
      },
    } as any)

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
      },
    } as any)

    const result = await payload.findByID({
      collection: "articles",
      id: published.id,
      overrideAccess: false,
      user: undefined as any,
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
      },
    } as any)

    await expect(
      payload.findByID({
        collection: "articles",
        id: draft.id,
        overrideAccess: false,
        user: undefined as any,
      }),
    ).rejects.toThrow()
  })
})
