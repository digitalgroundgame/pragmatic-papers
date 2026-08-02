import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Article } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"
import { ARTICLE_CONTENT } from "../fixtures/content"

describe("field-level access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  describe("editorFieldLevel on publishedAt (Articles)", () => {
    it("allows editor to update publishedAt", async () => {
      const editor = await createUser("editor")

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "PublishedAt Editor - fieldLevel",
          content: ARTICLE_CONTENT,
          _status: "draft",
        } as unknown as Article,
      })

      const updated = await payload.update({
        collection: "articles",
        id: article.id,
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
        data: { publishedAt: new Date().toISOString() },
      })

      expect(updated.publishedAt).toBeDefined()
    })

    it("denies writer from updating publishedAt", async () => {
      const writer = await createUser("writer")

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "PublishedAt Writer - fieldLevel",
          content: ARTICLE_CONTENT,
          _status: "draft",
        } as unknown as Article,
        user: writer,
      })

      const updated = await payload.update({
        collection: "articles",
        id: article.id,
        overrideAccess: false,
        user: writer,
        context: { disableRevalidate: true },
        data: { publishedAt: new Date().toISOString() },
      })

      // Field-level access denial is a silent drop — Payload returns the
      // response with the field value nulled/unchanged rather than throwing.
      // This differs from collection-level denial which throws a NotFound error.
      expect(updated.publishedAt).toBeNull()
    })
  })

  describe("adminFieldLevel on roles (Users)", () => {
    it("allows admin to update another user's roles", async () => {
      const admin = await createUser("admin")
      const target = await createUser("member")

      const updated = await payload.update({
        collection: "users",
        id: target.id,
        overrideAccess: false,
        user: admin,
        context: { disableRevalidate: true },
        data: { roles: ["narrator"] },
      })

      expect(updated.roles).toContain("narrator")
    })

    it("denies non-admin user from updating their own roles", async () => {
      const editor = await createUser("editor")

      const updated = await payload.update({
        collection: "users",
        id: editor.id,
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
        data: { roles: ["narrator"] },
      })

      // Same silent-drop behavior: the roles field is ignored, not thrown.
      expect(updated.roles).toContain("editor")
      expect(updated.roles).not.toContain("narrator")
    })
  })

  describe("never-updatable fields (() => false)", () => {
    it("denies admin from updating createdBy on articles", async () => {
      const admin = await createUser("admin")
      const writer = await createUser("writer")

      const article = await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "CreatedBy Field - fieldLevel",
          content: ARTICLE_CONTENT,
          _status: "draft",
        } as unknown as Article,
        user: writer,
      })

      const updated = await payload.update({
        collection: "articles",
        id: article.id,
        overrideAccess: false,
        user: admin,
        context: { disableRevalidate: true },
        data: { createdBy: admin.id },
      })

      expect(updated.createdBy).toEqual(article.createdBy)
    })
  })
})
