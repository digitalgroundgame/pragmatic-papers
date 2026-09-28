import { describe, expect, it } from "vitest"

import { isRecord } from "../isRecord"

describe("isRecord", () => {
  it("accepts a plain object, however it was made", () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord(JSON.parse('{"a":1}'))).toBe(true)
    expect(isRecord(Object.create(null))).toBe(true)
  })

  it("rejects the two things `typeof` calls an object", () => {
    expect(isRecord(null)).toBe(false)
    expect(isRecord([])).toBe(false)
    expect(isRecord([{ a: 1 }])).toBe(false)
  })

  it("rejects everything that is not an object", () => {
    for (const v of ["", "a", 0, 1, NaN, true, false, undefined, Symbol("s"), 1n, isRecord])
      expect(isRecord(v)).toBe(false)
  })
})
