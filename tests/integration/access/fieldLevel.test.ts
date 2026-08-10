import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Article, User } from "@/payload-types"
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

    it("adds the author role alongside a contributor role", async () => {
      const admin = await createUser("admin")
      const target = await createUser("member")

      const updated = await payload.update({
        collection: "users",
        id: target.id,
        overrideAccess: false,
        user: admin,
        context: { disableRevalidate: true },
        data: { roles: ["writer"] },
      })

      // Every contributor carries `author`, so stepping down later is just
      // dropping `writer`.
      expect(updated.roles).toContain("writer")
      expect(updated.roles).toContain("author")
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

  describe("field-level read access (Users)", () => {
    it("hides email and roles from anonymous users", async () => {
      const writer = await createUser("writer")

      const result = await payload.findByID({
        collection: "users",
        id: writer.id,
        overrideAccess: false,
        user: null,
      })

      // In Payload 3, restricted fields are either undefined or null in the returned document.
      expect(result.email).toBeUndefined()
      expect(result.roles).toBeUndefined()
    })

    it("allows a user to read their own email and roles", async () => {
      const writer = await createUser("writer")

      const result = await payload.findByID({
        collection: "users",
        id: writer.id,
        overrideAccess: false,
        user: writer,
      })

      expect(result.email).toBe(writer.email)
      expect(result.roles).toContain("writer")
    })

    it("allows an admin to read other users' email and roles", async () => {
      const admin = await createUser("admin")
      const writer = await createUser("writer")

      const result = await payload.findByID({
        collection: "users",
        id: writer.id,
        overrideAccess: false,
        user: admin,
      })

      expect(result.email).toBe(writer.email)
      expect(result.roles).toContain("writer")
    })

    it("hides email and roles from non-admin staff reading another user", async () => {
      const editor = await createUser("editor")
      const writer = await createUser("writer")

      const result = await payload.findByID({
        collection: "users",
        id: writer.id,
        overrideAccess: false,
        user: editor,
      })

      // Staff may read the user document (readUsers), but `email`/`roles` stay
      // private to the user themselves and admins (selfOrAdminFieldLevel).
      expect(result.email).toBeUndefined()
      expect(result.roles).toBeUndefined()
    })
  })

  describe("article author population (Articles)", () => {
    it("does not expose author email or roles to anonymous readers", async () => {
      const writer = await createUser("writer")

      await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Author field exposure - fieldLevel",
          content: ARTICLE_CONTENT,
          authors: [writer.id],
          _status: "published",
        } as unknown as Article,
      })

      const { docs } = await payload.find({
        collection: "articles",
        depth: 1,
        overrideAccess: false,
        user: null,
        where: { title: { equals: "Author field exposure - fieldLevel" } },
      })

      const author = docs[0]?.authors?.[0]
      expect(typeof author).toBe("object")
      expect((author as User).name).toBe(writer.name)
      expect((author as User).email).toBeUndefined()
      expect((author as User).roles).toBeUndefined()
    })

    it("leaves a bare ID for an author who fails the read check", async () => {
      const writer = await createUser("writer")
      // `filterOptions` on the authors field rejects a member outright, so the
      // only way an article ends up with one is a demotion after publication.
      const demoted = await createUser("writer")

      await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Demoted author - fieldLevel",
          content: ARTICLE_CONTENT,
          authors: [writer.id, demoted.id],
          _status: "published",
        } as unknown as Article,
      })

      await payload.update({
        collection: "users",
        id: demoted.id,
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: { roles: ["member"] },
      })

      // Dropping someone to member-only removes them from bylines: Payload
      // leaves the bare ID and nothing backfills it. Use the `author` role to
      // offboard a contributor without retracting their credit.
      const { docs } = await payload.find({
        collection: "articles",
        depth: 1,
        overrideAccess: false,
        user: null,
        where: { title: { equals: "Demoted author - fieldLevel" } },
      })

      const authors = docs[0]?.authors ?? []
      expect((authors[0] as User).id).toBe(writer.id)
      expect((authors[0] as User).email).toBeUndefined()
      expect(authors[1]).toBe(demoted.id)
    })

    it("keeps a byline intact when a writer is moved to the author role", async () => {
      const retiring = await createUser("writer")

      await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Retired author byline - fieldLevel",
          content: ARTICLE_CONTENT,
          authors: [retiring.id],
          _status: "published",
        } as unknown as Article,
      })

      // Offboarding: drop the permission, keep the credit.
      await payload.update({
        collection: "users",
        id: retiring.id,
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: { roles: ["author"] },
      })

      const { docs } = await payload.find({
        collection: "articles",
        depth: 1,
        overrideAccess: false,
        user: null,
        where: { title: { equals: "Retired author byline - fieldLevel" } },
      })

      const author = docs[0]?.authors?.[0] as User
      expect(author.id).toBe(retiring.id)
      expect(author.name).toBe(retiring.name)
      expect(author.email).toBeUndefined()
      expect(author.roles).toBeUndefined()
    })
  })
})
