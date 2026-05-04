import { describe, it, expect } from "vitest"
import { isAutosave } from "./isAutosave"

describe("isAutosave", () => {
  it("returns true when autosave query is true (boolean)", () => {
    expect(
      isAutosave({ query: { autosave: true } } as unknown as Parameters<typeof isAutosave>[0]),
    ).toBe(true)
  })

  it('returns true when autosave query is "true" (string)', () => {
    expect(
      isAutosave({ query: { autosave: "true" } } as unknown as Parameters<typeof isAutosave>[0]),
    ).toBe(true)
  })

  it("returns true when autosave query is 1 (number)", () => {
    expect(
      isAutosave({ query: { autosave: 1 } } as unknown as Parameters<typeof isAutosave>[0]),
    ).toBe(true)
  })

  it('returns true when autosave query is "1" (string)', () => {
    expect(
      isAutosave({ query: { autosave: "1" } } as unknown as Parameters<typeof isAutosave>[0]),
    ).toBe(true)
  })

  it("returns false when autosave query is false", () => {
    expect(
      isAutosave({ query: { autosave: false } } as unknown as Parameters<typeof isAutosave>[0]),
    ).toBe(false)
  })

  it('returns false when autosave query is "false"', () => {
    expect(
      isAutosave({ query: { autosave: "false" } } as unknown as Parameters<typeof isAutosave>[0]),
    ).toBe(false)
  })

  it("returns false when autosave query is not present", () => {
    expect(isAutosave({ query: {} } as unknown as Parameters<typeof isAutosave>[0])).toBe(false)
  })

  it("returns false for empty query", () => {
    expect(isAutosave({} as unknown as Parameters<typeof isAutosave>[0])).toBe(false)
  })
})
