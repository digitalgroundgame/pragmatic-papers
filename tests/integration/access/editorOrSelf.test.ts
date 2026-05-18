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

describe("editor and writer access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
  })

  describe("editorOrSelf access", () => {
    it("allows editor to delete any article", async () => {
      const editor = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "editor-eos-eos@example.com",
          password: "test-password",
          name: "Editor EoS - eos",
          role: "editor",
        },
      } as any)

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Article Editor Delete EoS - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
        },
      } as any)

      const deleted = await payload.delete({
        collection: "articles",
        id: article.id,
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
      })

      expect(deleted.id).toBe(article.id)
    })

    it("allows writer to delete their own article", async () => {
      const writer = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "writer-eos-eos@example.com",
          password: "test-password",
          name: "Writer EoS - eos",
          role: "writer",
        },
      } as any)

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Article Writer Own EoS - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writer.id,
        },
        user: writer,
      } as any)

      const deleted = await payload.delete({
        collection: "articles",
        id: article.id,
        overrideAccess: false,
        user: writer,
        context: { disableRevalidate: true },
      })

      expect(deleted.id).toBe(article.id)
    })

    it("denies writer from deleting another user's article", async () => {
      const writerA = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "writer-a-eos-eos@example.com",
          password: "test-password",
          name: "Writer A EoS - eos",
          role: "writer",
        },
      } as any)

      const writerB = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "writer-b-eos-eos@example.com",
          password: "test-password",
          name: "Writer B EoS - eos",
          role: "writer",
        },
      } as any)

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Article Writer Other EoS - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writerA.id,
        },
        user: writerA,
      } as any)

      await expect(
        payload.delete({
          collection: "articles",
          id: article.id,
          overrideAccess: false,
          user: writerB,
          context: { disableRevalidate: true },
        }),
      ).rejects.toThrow()
    })
  })

  describe("restrictWritersToDraftOnly access", () => {
    it("allows editor to update any article regardless of status", async () => {
      const editor = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "editor-rwtd-eos@example.com",
          password: "test-password",
          name: "Editor Rwtd - eos",
          role: "editor",
        },
      } as any)

      const published = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Published Article Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "published",
        },
      } as any)

      const updated = await payload.update({
        collection: "articles",
        id: published.id,
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
        data: { title: "Updated Published by Editor" },
      })

      expect((updated as any).title).toBe("Updated Published by Editor")
    })

    it("allows writer to update their own draft article", async () => {
      const writer = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "writer-draft-eos@example.com",
          password: "test-password",
          name: "Writer Draft - eos",
          role: "writer",
        },
      } as any)

      const draft = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Draft Article Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writer.id,
        },
        user: writer,
      } as any)

      const updated = await payload.update({
        collection: "articles",
        id: draft.id,
        overrideAccess: false,
        user: writer,
        context: { disableRevalidate: true },
        data: { title: "Updated Draft by Writer" },
      })

      expect((updated as any).title).toBe("Updated Draft by Writer")
    })

    it("denies writer from updating their own published article", async () => {
      const writer = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "writer-pub-eos@example.com",
          password: "test-password",
          name: "Writer Pub Rwtd - eos",
          role: "writer",
        },
      } as any)

      const published = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Published Article Writer Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "published",
          createdBy: writer.id,
        },
        user: writer,
      } as any)

      await expect(
        payload.update({
          collection: "articles",
          id: published.id,
          overrideAccess: false,
          user: writer,
          context: { disableRevalidate: true },
          data: { title: "Should Not Update Published" },
        }),
      ).rejects.toThrow()
    })

    it("denies writer from updating another user's draft article", async () => {
      const writerA = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "writer-a-rwtd-eos@example.com",
          password: "test-password",
          name: "Writer A Rwtd - eos",
          role: "writer",
        },
      } as any)

      const writerB = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "writer-b-rwtd-eos@example.com",
          password: "test-password",
          name: "Writer B Rwtd - eos",
          role: "writer",
        },
      } as any)

      const draft = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Draft Other Writer Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writerA.id,
        },
        user: writerA,
      } as any)

      await expect(
        payload.update({
          collection: "articles",
          id: draft.id,
          overrideAccess: false,
          user: writerB,
          context: { disableRevalidate: true },
          data: { title: "Should Not Update Others Draft" },
        }),
      ).rejects.toThrow()
    })
  })
})
