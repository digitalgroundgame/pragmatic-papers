import type { User } from "@/payload-types"
import type { CollectionBeforeChangeHook } from "payload"
import { describe, expect, it } from "vitest"
import { ensureAuthorRole } from "../ensureAuthorRole"

type HookArgs = Parameters<CollectionBeforeChangeHook<User>>[0]

const run = (data: Partial<User>) =>
  ensureAuthorRole({ data } as unknown as HookArgs) as Partial<User>

describe("ensureAuthorRole beforeChange hook", () => {
  it("adds author alongside every contributor role", () => {
    for (const role of ["writer", "editor", "chief-editor", "narrator"]) {
      const result = run({ roles: [role] } as Partial<User>)
      expect(result.roles).toEqual([role, "author"])
    }
  })

  it("keeps the contributor's other roles", () => {
    const result = run({ roles: ["writer", "narrator"] } as Partial<User>)

    expect(result.roles).toEqual(["writer", "narrator", "author"])
  })

  it("leaves author in place when stepping down to it alone", () => {
    // The offboarding path: the contributor role is removed, `author` remains.
    const result = run({ roles: ["author"] } as Partial<User>)

    expect(result.roles).toEqual(["author"])
  })

  it("does not add author twice", () => {
    const result = run({ roles: ["writer", "author"] } as Partial<User>)

    expect(result.roles).toEqual(["writer", "author"])
  })

  it("does not grant author to members or admins", () => {
    expect(run({ roles: ["member"] } as Partial<User>).roles).toEqual(["member"])
    expect(run({ roles: ["admin"] } as Partial<User>).roles).toEqual(["admin"])
  })

  it("ignores updates that do not touch roles", () => {
    const data = { name: "Jane Doe" } as Partial<User>

    expect(run(data)).toBe(data)
  })
})
