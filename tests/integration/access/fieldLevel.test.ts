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

    it("denies admin from updating store-owned fields on merch", async () => {
      const admin = await createUser("admin")

      const product = await payload.create({
        collection: "merch",
        // The collection denies `create` outright — rows come from the sync,
        // which writes with overrideAccess just like this.
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Store Owned - fieldLevel",
          externalId: "gid://shopify/Product/fieldlevel",
          handle: "store-owned-fieldlevel",
          price: "65.00",
          status: "active",
        },
      })

      const updated = await payload.update({
        collection: "merch",
        id: product.id,
        overrideAccess: false,
        user: admin,
        context: { disableRevalidate: true },
        // What the bulk-edit drawer sends. `admin.readOnly` never stopped this
        // — only field-level access does.
        data: { title: "Test", price: "0.01" },
      })

      expect(updated.title).toBe("Store Owned - fieldLevel")
      expect(updated.price).toBe("65.00")
    })

    it("still lets an admin edit the presentation fields on merch", async () => {
      const admin = await createUser("admin")

      const product = await payload.create({
        collection: "merch",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Editorial - fieldLevel",
          externalId: "gid://shopify/Product/editorial",
          handle: "editorial-fieldlevel",
          status: "active",
        },
      })

      const updated = await payload.update({
        collection: "merch",
        id: product.id,
        overrideAccess: false,
        user: admin,
        context: { disableRevalidate: true },
        data: { featured: true, badgeOverride: "Last few" },
      })

      expect(updated.featured).toBe(true)
      expect(updated.badgeOverride).toBe("Last few")
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

    it("returns bare IDs at depth 0 rather than unsanitized user docs", async () => {
      const writer = await createUser("writer")

      await payload.create({
        collection: "articles",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          title: "Depth 0 authors - fieldLevel",
          content: ARTICLE_CONTENT,
          authors: [writer.id],
          _status: "published",
        } as unknown as Article,
      })

      // Articles are publicly readable and REST accepts a `depth` param. With
      // no afterRead hook writing into `doc.authors`, depth 0 returns the
      // relationship as plain IDs — nothing to leak.
      const { docs } = await payload.find({
        collection: "articles",
        depth: 0,
        overrideAccess: false,
        user: null,
        where: { title: { equals: "Depth 0 authors - fieldLevel" } },
      })

      expect(docs[0]?.authors).toEqual([writer.id])
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

      // Payload leaves the bare ID for a user the caller cannot read, and the
      // co-author it did populate is unaffected.
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
      expect((authors[0] as User).roles).toBeUndefined()
      expect(authors[1]).toBe(demoted.id)
    })
  })
})
