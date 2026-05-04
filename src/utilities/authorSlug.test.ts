import { describe, it, expect } from "vitest"
import { authorSlugFromUser, authorSlugFromNameAndId } from "./authorSlug"

describe("authorSlug", () => {
  describe("authorSlugFromUser", () => {
    it("generates slug from user name", () => {
      const user = { name: "Alice Smith", id: "123" } as unknown as Parameters<
        typeof authorSlugFromUser
      >[0]
      expect(authorSlugFromUser(user)).toBe("alice-smith")
    })

    it("generates slug from user id when name is missing", () => {
      const user = { id: "123" } as unknown as Parameters<typeof authorSlugFromUser>[0]
      expect(authorSlugFromUser(user)).toBe("author-123")
    })

    it("handles names with special characters", () => {
      const user = { name: "Alice & Bob!", id: "123" } as unknown as Parameters<
        typeof authorSlugFromUser
      >[0]
      expect(authorSlugFromUser(user)).toBe("alice-bob")
    })

    it("handles names with multiple spaces", () => {
      const user = { name: "Alice   Smith", id: "123" } as unknown as Parameters<
        typeof authorSlugFromUser
      >[0]
      expect(authorSlugFromUser(user)).toBe("alice-smith")
    })
  })

  describe("authorSlugFromNameAndId", () => {
    it("generates slug from name", () => {
      expect(authorSlugFromNameAndId("Alice Smith", "123")).toBe("alice-smith")
    })

    it("falls back to id when name is empty", () => {
      expect(authorSlugFromNameAndId("", "123")).toBe("123")
    })

    it("falls back to id when name is null", () => {
      expect(authorSlugFromNameAndId(null, "123")).toBe("123")
    })

    it('falls back to "author" when both name and id are missing', () => {
      expect(authorSlugFromNameAndId(null, null)).toBe("author")
    })

    it("handles names with special characters", () => {
      expect(authorSlugFromNameAndId("Alice & Bob!", "123")).toBe("alice-bob")
    })
  })
})
