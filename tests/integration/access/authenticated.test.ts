/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

describe("authenticated and anyone access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayloadConfig()
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
        user: undefined as any,
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
        user: undefined as any,
      })

      expect(result.id).toBe(category.id)
    })
  })

  describe("authenticated (create/update/delete on categories)", () => {
    it("allows any logged-in user to create a category", async () => {
      const member = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "member-auth-auth@example.com",
          password: "test-password",
          name: "Member Auth - auth",
          role: "member",
        },
      } as any)

      const category = await payload.create({
        collection: "categories",
        overrideAccess: false,
        user: member,
        draft: true,
        data: { title: "Category by Member Auth - auth" },
      })

      expect(category).toBeDefined()
      expect((category as any).title).toBe("Category by Member Auth - auth")
    })

    it("denies unauthenticated users from creating a category", async () => {
      await expect(
        payload.create({
          collection: "categories",
          overrideAccess: false,
          user: undefined as any,
          draft: true,
          data: { title: "Should Not Create Category - auth" },
        }),
      ).rejects.toThrow()
    })

    it("allows any logged-in user to update a category", async () => {
      const narrator = await payload.create({
        collection: "users",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: {
          email: "narrator-auth-auth@example.com",
          password: "test-password",
          name: "Narrator Auth - auth",
          role: "narrator",
        },
      } as any)

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

      expect((updated as any).title).toBe("Updated by Narrator")
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
          user: undefined as any,
          data: { title: "Should Not Update" },
        }),
      ).rejects.toThrow()
    })
  })
})
