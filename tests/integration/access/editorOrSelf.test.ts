import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Article } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"
import { ARTICLE_CONTENT } from "../fixtures/content"

describe("editor and writer access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  describe("editorOrSelf access", () => {
    it("allows editor to delete any article", async () => {
      const editor = await createUser("editor")

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Article Editor Delete EoS - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
        } as unknown as Article,
      })

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
      const writer = await createUser("writer")

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Article Writer Own EoS - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writer.id,
        } as unknown as Article,
        user: writer,
      })

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
      const writerA = await createUser("writer")
      const writerB = await createUser("writer")

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Article Writer Other EoS - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writerA.id,
        } as unknown as Article,
        user: writerA,
      })

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
      const editor = await createUser("editor")

      const published = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Published Article Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "published",
        } as unknown as Article,
      })

      const updated = await payload.update({
        collection: "articles",
        id: published.id,
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
        data: { title: "Updated Published by Editor" },
      })

      expect(updated.title).toBe("Updated Published by Editor")
    })

    it("allows writer to update their own draft article", async () => {
      const writer = await createUser("writer")

      const draft = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Draft Article Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writer.id,
        } as unknown as Article,
        user: writer,
      })

      const updated = await payload.update({
        collection: "articles",
        id: draft.id,
        overrideAccess: false,
        user: writer,
        context: { disableRevalidate: true },
        data: { title: "Updated Draft by Writer" },
      })

      expect(updated.title).toBe("Updated Draft by Writer")
    })

    it("denies writer from updating their own published article", async () => {
      const writer = await createUser("writer")

      const published = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Published Article Writer Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "published",
          createdBy: writer.id,
        } as unknown as Article,
        user: writer,
      })

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
      const writerA = await createUser("writer")
      const writerB = await createUser("writer")

      const draft = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Draft Other Writer Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: writerA.id,
        } as unknown as Article,
        user: writerA,
      })

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

    it("denies narrator from updating any article", async () => {
      const narrator = await createUser("narrator")

      const draft = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Draft Narrator Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: narrator.id,
        } as unknown as Article,
        user: narrator,
      })

      await expect(
        payload.update({
          collection: "articles",
          id: draft.id,
          overrideAccess: false,
          user: narrator,
          context: { disableRevalidate: true },
          data: { title: "Should Not Update as Narrator" },
        }),
      ).rejects.toThrow()
    })

    it("denies member from updating any article", async () => {
      const member = await createUser("member")

      const draft = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Draft Member Rwtd - eos",
          content: ARTICLE_CONTENT,
          _status: "draft",
          createdBy: member.id,
        } as unknown as Article,
        user: member,
      })

      await expect(
        payload.update({
          collection: "articles",
          id: draft.id,
          overrideAccess: false,
          user: member,
          context: { disableRevalidate: true },
          data: { title: "Should Not Update as Member" },
        }),
      ).rejects.toThrow()
    })
  })
})
