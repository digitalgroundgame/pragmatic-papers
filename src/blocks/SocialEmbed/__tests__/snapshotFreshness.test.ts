// @vitest-environment node
import { describe, expect, it } from "vitest"

import { shouldEnhance } from "../helpers/snapshotFreshness"

describe("shouldEnhance", () => {
  it("enhances only snapshots that fetched successfully", () => {
    expect(shouldEnhance({ status: "ok" })).toBe(true)
    expect(shouldEnhance({ status: "not_found" })).toBe(false)
    expect(shouldEnhance({})).toBe(false)
    expect(shouldEnhance(null)).toBe(false)
    expect(shouldEnhance(undefined)).toBe(false)
  })
})
