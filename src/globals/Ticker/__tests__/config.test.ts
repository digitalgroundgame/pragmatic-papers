import type { Field } from "payload"
import { describe, expect, it } from "vitest"

import { Ticker } from "../config"

const urlField = (Ticker.fields[0] as Extract<Field, { type: "array" }>).fields[0] as {
  validate: (value: string | null | undefined) => true | string
}

const user = (roles: string[]) => ({ req: { user: { roles } } }) as never

describe("Ticker global", () => {
  it("takes a link to a post on Bluesky or X", () => {
    expect(urlField.validate("https://bsky.app/profile/pp.bsky.social/post/3k1")).toBe(true)
    expect(urlField.validate("https://x.com/PragPapers/status/42")).toBe(true)
  })

  it.each([
    ["a profile", "https://bsky.app/profile/pp.bsky.social"],
    ["the post's text", "Volume 12 is out"],
    ["nothing", null],
  ])("refuses %s, saying what to paste", (_, value) => {
    expect(urlField.validate(value)).toMatch(/Paste a post's link/)
  })

  it("is read and changed by editors and admins, not writers", () => {
    const { read, update } = Ticker.access!
    for (const roles of [["admin"], ["editor"], ["chief-editor"]]) {
      expect(read!(user(roles))).toBe(true)
      expect(update!(user(roles))).toBe(true)
    }
    expect(update!(user(["writer"]))).toBe(false)
    expect(read!({ req: { user: null } } as never)).toBe(false)
  })
})
