import { describe, expect, it } from "vitest"

import { MAX_NAME_LENGTH, normalizeName } from "../endpoints/account"

describe("normalizeName", () => {
  it("collapses spaces and drops control characters", () => {
    expect(normalizeName("  Ada \t  Lovelace\u0007 ")).toEqual({ ok: true, name: "Ada Lovelace" })
  })

  it.each([[undefined], [42], [""], ["   "]])("refuses %j", (raw) => {
    expect(normalizeName(raw)).toEqual({ ok: false, message: "Enter a name." })
  })

  it("refuses a name that's too long", () => {
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH + 1))).toMatchObject({ ok: false })
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH))).toMatchObject({ ok: true })
  })
})
