import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Media } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"
import { testFile } from "../fixtures/media"

describe("media editorOrSelf access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
  })

  describe("read", () => {
    it("allows unauthenticated user to read media", async () => {
      const admin = await createUser("admin")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Public Media - media" } as unknown as Media,
        user: admin,
      })

      const result = await payload.findByID({
        collection: "media",
        id: media.id,
        overrideAccess: false,
        user: undefined,
      })

      expect(result.id).toBe(media.id)
    })
  })

  describe("create", () => {
    it("denies unauthenticated user from creating media", async () => {
      await expect(
        payload.create({
          collection: "media",
          overrideAccess: false,
          context: { disableRevalidate: true },
          file: testFile(),
          data: { alt: "Unauthenticated Create" } as unknown as Media,
          user: undefined,
        }),
      ).rejects.toThrow()
    })

    it("denies unauthenticated user from updating media", async () => {
      const admin = await createUser("admin")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Unauthenticated Update Media - media" } as unknown as Media,
        user: admin,
      })

      await expect(
        payload.update({
          collection: "media",
          id: media.id,
          overrideAccess: false,
          user: undefined,
          context: { disableRevalidate: true },
          data: { alt: "Should Not Update" },
        }),
      ).rejects.toThrow()
    })

    it("denies unauthenticated user from deleting media", async () => {
      const admin = await createUser("admin")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Unauthenticated Delete Media - media" } as unknown as Media,
        user: admin,
      })

      await expect(
        payload.delete({
          collection: "media",
          id: media.id,
          overrideAccess: false,
          user: undefined,
          context: { disableRevalidate: true },
        }),
      ).rejects.toThrow()
    })
  })

  describe("delete", () => {
    it("allows editor to delete any media", async () => {
      const editor = await createUser("editor")
      const writerA = await createUser("writer")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Media Editor Delete - media" } as unknown as Media,
        user: writerA,
      })

      const deleted = await payload.delete({
        collection: "media",
        id: media.id,
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
      })

      expect(deleted.id).toBe(media.id)
    })

    it("allows writer to delete their own media", async () => {
      const writer = await createUser("writer")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Media Writer Own Delete - media" } as unknown as Media,
        user: writer,
      })

      const deleted = await payload.delete({
        collection: "media",
        id: media.id,
        overrideAccess: false,
        user: writer,
        context: { disableRevalidate: true },
      })

      expect(deleted.id).toBe(media.id)
    })

    it("denies writer from deleting another user's media", async () => {
      const writerA = await createUser("writer")
      const writerB = await createUser("writer")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Media Writer Other Delete - media" } as unknown as Media,
        user: writerA,
      })

      await expect(
        payload.delete({
          collection: "media",
          id: media.id,
          overrideAccess: false,
          user: writerB,
          context: { disableRevalidate: true },
        }),
      ).rejects.toThrow()
    })
  })

  describe("update", () => {
    it("allows editor to update any media", async () => {
      const editor = await createUser("editor")
      const writerA = await createUser("writer")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Media Editor Update - media" } as unknown as Media,
        user: writerA,
      })

      const updated = await payload.update({
        collection: "media",
        id: media.id,
        overrideAccess: false,
        user: editor,
        context: { disableRevalidate: true },
        data: { alt: "Updated by Editor" },
      })

      expect(updated.alt).toBe("Updated by Editor")
    })

    it("allows writer to update their own media", async () => {
      const writer = await createUser("writer")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Media Writer Own Update - media" } as unknown as Media,
        user: writer,
      })

      const updated = await payload.update({
        collection: "media",
        id: media.id,
        overrideAccess: false,
        user: writer,
        context: { disableRevalidate: true },
        data: { alt: "Updated by Writer" },
      })

      expect(updated.alt).toBe("Updated by Writer")
    })

    it("denies writer from updating another user's media", async () => {
      const writerA = await createUser("writer")
      const writerB = await createUser("writer")

      const media = await payload.create({
        collection: "media",
        overrideAccess: true,
        context: { disableRevalidate: true },
        file: testFile(),
        data: { alt: "Media Writer Other Update - media" } as unknown as Media,
        user: writerA,
      })

      await expect(
        payload.update({
          collection: "media",
          id: media.id,
          overrideAccess: false,
          user: writerB,
          context: { disableRevalidate: true },
          data: { alt: "Should Not Update" },
        }),
      ).rejects.toThrow()
    })
  })
})
