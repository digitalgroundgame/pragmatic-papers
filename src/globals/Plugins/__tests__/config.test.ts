import { describe, expect, it } from "vitest"

import type { User } from "@/payload-types"

import { Plugins } from "../config"

const user = (roles: string[]) => ({ id: 1, roles }) as unknown as User
// Only `req.user` is read, so the rest of the access args can be left out.
const args = (u: User | null) => ({ req: { user: u } }) as never

describe("Plugins global", () => {
  it("lets admins read and save it", () => {
    expect(Plugins.access?.read?.(args(user(["admin"])))).toBe(true)
    expect(Plugins.access?.read?.(args(user(["chief-editor"])))).toBe(true)
    expect(Plugins.access?.read?.(args(user(["editor"])))).toBe(false)
    expect(Plugins.access?.read?.(args(null))).toBe(false)
    expect(Plugins.access?.update?.(args(user(["admin"])))).toBe(true)
    expect(Plugins.access?.update?.(args(user(["editor"])))).toBe(false)
  })

  it("shows up under System for admins only", () => {
    expect(Plugins.admin?.group).toBe("System")
    const hidden = Plugins.admin?.hidden as (a: { user: User | null }) => boolean
    expect(hidden({ user: user(["admin"]) })).toBe(false)
    expect(hidden({ user: user(["writer"]) })).toBe(true)
    expect(hidden({ user: null })).toBe(true)
  })
})
