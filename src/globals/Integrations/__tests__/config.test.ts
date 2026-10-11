import type { Field } from "payload"
import { describe, expect, it } from "vitest"

import { Integrations } from "../config"

/** The field at `path` (names joined by dots), through groups and arrays. */
function fieldAt(fields: Field[], path: string): Field {
  const [name, ...rest] = path.split(".")
  const field = fields.find((f) => "name" in f && f.name === name)
  if (!field) throw new Error(`No field ${name}`)
  if (rest.length === 0) return field
  if (!("fields" in field)) throw new Error(`${name} has no fields`)
  return fieldAt(field.fields, rest.join("."))
}

const channelField = fieldAt(Integrations.fields, "youtube.channels.channelId")
const validate = (value: string | null | undefined) =>
  (channelField as { validate: (v: string | null | undefined) => true | string }).validate(value)

const user = (roles: string[]) => ({ req: { user: { roles } } }) as never

describe("Integrations global", () => {
  it("accepts a channel ID, with stray spaces around it", () => {
    expect(validate("UCabcdefghijklmnopqrstuv")).toBe(true)
    expect(validate("  UC_abcdefghij-klmnopqrst ")).toBe(true)
  })

  it.each([
    ["a handle", "@PragmaticPapers"],
    ["a channel URL", "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"],
    ["an ID that's too short", "UCabc"],
    ["nothing", ""],
    ["null", null],
  ])("rejects %s, saying what an ID looks like", (_, value) => {
    expect(validate(value)).toMatch(/starts with UC and is 24 characters/)
  })

  it("is read and changed by admins only", () => {
    const { read, update } = Integrations.access!
    expect(read!(user(["admin"]))).toBe(true)
    expect(update!(user(["admin"]))).toBe(true)
    expect(read!(user(["editor"]))).toBe(false)
    expect(update!(user(["editor"]))).toBe(false)
    expect(read!({ req: { user: null } } as never)).toBe(false)
  })
})
