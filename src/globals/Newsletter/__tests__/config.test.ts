import { describe, expect, it } from "vitest"

import type { User } from "@/payload-types"

import { Newsletter } from "../config"

const user = (roles: string[]) => ({ id: 1, roles }) as unknown as User
// Only `req.user` is read, so the rest of the access args can be left out.
const args = (u: User | null) => ({ req: { user: u } }) as never

describe("Newsletter global", () => {
  it("lets admins read it and nobody save it", () => {
    expect(Newsletter.access?.read?.(args(user(["admin"])))).toBe(true)
    expect(Newsletter.access?.read?.(args(user(["chief-editor"])))).toBe(true)
    expect(Newsletter.access?.read?.(args(user(["editor"])))).toBe(false)
    expect(Newsletter.access?.read?.(args(null))).toBe(false)
    expect(Newsletter.access?.update?.(args(user(["admin"])))).toBe(false)
  })

  it("shows up in the sidebar for admins only", () => {
    const hidden = Newsletter.admin?.hidden as (a: { user: User | null }) => boolean
    expect(hidden({ user: user(["admin"]) })).toBe(false)
    expect(hidden({ user: user(["writer"]) })).toBe(true)
    expect(hidden({ user: null })).toBe(true)
  })
})
