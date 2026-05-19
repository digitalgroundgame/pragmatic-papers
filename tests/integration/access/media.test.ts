import { describe, expect, it, beforeAll } from "vitest"
import type { Payload } from "payload"
import type { Media } from "@/payload-types"
import { getPayload, createUser } from "../helpers/testUsers"

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

function testFile(name = "test.png") {
  return {
    name,
    data: MINIMAL_PNG,
    mimetype: "image/png" as const,
    size: MINIMAL_PNG.length,
  }
}

describe("media editorOrSelf access", () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload()
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
