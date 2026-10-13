import { describe, expect, it } from "vitest"

import { isPlaceholderEmail, placeholderEmail } from "../placeholderEmail"

describe("placeholderEmail", () => {
  it("is unique to the provider account, in a domain that can't receive mail", () => {
    expect(placeholderEmail("destiny", 42)).toBe("destiny-42@no-email.invalid")
    expect(placeholderEmail("destiny", "43")).not.toBe(placeholderEmail("destiny", 42))
  })

  it("tells a placeholder from a real address", () => {
    expect(isPlaceholderEmail("destiny-42@no-email.invalid")).toBe(true)
    expect(isPlaceholderEmail("Destiny-42@No-Email.Invalid")).toBe(true)
    expect(isPlaceholderEmail("ada@example.com")).toBe(false)
    expect(isPlaceholderEmail("ada@no-email.invalid.example.com")).toBe(false)
    expect(isPlaceholderEmail(null)).toBe(false)
  })
})
