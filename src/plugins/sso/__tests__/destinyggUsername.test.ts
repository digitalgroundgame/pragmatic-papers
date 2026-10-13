import { describe, expect, it } from "vitest"

import { destinyggUsernameField, normalizeDestinyggUsername } from "../destinyggUsername"

describe("normalizeDestinyggUsername", () => {
  it.each([
    ["Someone", "someone"],
    ["  @Someone ", "someone"],
    ["", null],
    ["   ", null],
    [null, null],
    [undefined, null],
  ])("stores %j as %j", (value, expected) => {
    expect(normalizeDestinyggUsername(value)).toBe(expected)
  })
})

describe("destinyggUsernameField", () => {
  it("is unique, and readable by staff only", () => {
    expect(destinyggUsernameField.unique).toBe(true)
    const read = destinyggUsernameField.access?.read
    expect(read?.({ req: { user: null } } as never)).toBe(false)
    expect(read?.({ req: { user: { id: 1 } } } as never)).toBe(true)
  })
})
