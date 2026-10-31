import type { Field, FieldAccess } from "payload"
import { describe, expect, it } from "vitest"

import { Header } from "@/Header/config"

import { tickerField } from "../field"

const named = (name: string): Field =>
  tickerField.fields.find((field) => "name" in field && field.name === name)!

const urlField = (named("hidden") as Extract<Field, { type: "array" }>).fields[0] as {
  validate: (value: string | null | undefined) => true | string
}

const req = (roles: string[] | null) =>
  ({ req: { user: roles ? { roles } : null } }) as Parameters<FieldAccess>[0]

describe("Header ticker field", () => {
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

  it("shows the posts and the hidden list only while the ticker is on", () => {
    for (const name of ["posts", "hidden"]) {
      const condition = (named(name) as { admin: { condition: (...args: unknown[]) => boolean } })
        .admin.condition
      expect(condition({}, { enabled: true })).toBe(true)
      expect(condition({}, { enabled: false })).toBe(false)
      expect(condition({}, undefined)).toBe(false)
    }
  })

  it("lets editors hide posts, and only admins switch the ticker or change the menus", () => {
    const update = Header.access!.update!
    expect(update(req(["editor"]) as never)).toBe(true)
    expect(update(req(["writer"]) as never)).toBe(false)

    const enabled = (named("enabled") as { access: { update: FieldAccess } }).access.update
    expect(enabled(req(["admin"]))).toBe(true)
    expect(enabled(req(["editor"]))).toBe(false)

    expect(tickerField.access!.read!(req(["editor"]))).toBe(true)
    expect(tickerField.access!.read!(req(["writer"]))).toBe(false)
    expect(tickerField.access!.read!(req(null))).toBe(false)
  })
})
