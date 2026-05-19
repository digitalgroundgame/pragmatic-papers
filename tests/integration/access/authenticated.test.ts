import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import { getPayload, createUser } from "../helpers/testUsers"

describe("authenticated and anyone access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  describe("anyone (read)", () => {
    it("allows unauthenticated users to read topics", async () => {
      const topic = await payload.create({
        collection: "topics",
        overrideAccess: true,
        draft: true,
        data: { name: "Public Topic Anyone - auth" },
      })

      const result = await payload.findByID({
        collection: "topics",
        id: topic.id,
        overrideAccess: false,
        user: undefined,
      })

      expect(result.id).toBe(topic.id)
    })

    it("allows unauthenticated users to read categories", async () => {
      const category = await payload.create({
        collection: "categories",
        overrideAccess: true,
        draft: true,
        data: { title: "Public Category Anyone - auth" },
      })

      const result = await payload.findByID({
        collection: "categories",
        id: category.id,
        overrideAccess: false,
        user: undefined,
      })

      expect(result.id).toBe(category.id)
    })
  })

  describe("authenticated (create/update/delete on categories)", () => {
    it("allows any logged-in user to create a category", async () => {
      const member = await createUser("member")

      const category = await payload.create({
        collection: "categories",
        overrideAccess: false,
        user: member,
        draft: true,
        data: { title: "Category by Member Auth - auth" },
      })

      expect(category).toBeDefined()
      expect(category.title).toBe("Category by Member Auth - auth")
    })

    it("denies unauthenticated users from creating a category", async () => {
      await expect(
        payload.create({
          collection: "categories",
          overrideAccess: false,
          user: undefined,
          draft: true,
          data: { title: "Should Not Create Category - auth" },
        }),
      ).rejects.toThrow()
    })

    it("allows any logged-in user to update a category", async () => {
      const narrator = await createUser("narrator")

      const category = await payload.create({
        collection: "categories",
        overrideAccess: true,
        draft: true,
        data: { title: "Category Update Auth - auth" },
      })

      const updated = await payload.update({
        collection: "categories",
        id: category.id,
        overrideAccess: false,
        user: narrator,
        data: { title: "Updated by Narrator" },
      })

      expect(updated.title).toBe("Updated by Narrator")
    })

    it("denies unauthenticated users from updating a category", async () => {
      const category = await payload.create({
        collection: "categories",
        overrideAccess: true,
        draft: true,
        data: { title: "Category No Update - auth" },
      })

      await expect(
        payload.update({
          collection: "categories",
          id: category.id,
          overrideAccess: false,
          user: undefined,
          data: { title: "Should Not Update" },
        }),
      ).rejects.toThrow()
    })
  })
})
