import { describe, expect, it } from "vitest"
import { admin, editor, writer, anyone, writerOrEditor, staff } from "@/access/collections"
import type { User } from "@/payload-types"
import type { AccessArgs } from "payload"

const makeUser = (roleOrRoles?: string | string[] | null): User => {
  if (!roleOrRoles) return { roles: [] } as unknown as User
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return { roles } as unknown as User
}

const makeArgs = (user: User | null) => ({ req: { user } }) as AccessArgs<User>

describe("admin helper access", () => {
  it("allows admin and chief-editor", () => {
    expect(admin(makeArgs(makeUser("admin")))).toBe(true)
    expect(admin(makeArgs(makeUser("chief-editor")))).toBe(true)
  })

  it("denies editor, writer, narrator, and member", () => {
    expect(admin(makeArgs(makeUser("editor")))).toBe(false)
    expect(admin(makeArgs(makeUser("writer")))).toBe(false)
    expect(admin(makeArgs(makeUser("narrator")))).toBe(false)
    expect(admin(makeArgs(makeUser("member")))).toBe(false)
  })
})

describe("editor helper access", () => {
  it("allows admin, chief-editor, and editor", () => {
    expect(editor(makeArgs(makeUser("admin")))).toBe(true)
    expect(editor(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(editor(makeArgs(makeUser("editor")))).toBe(true)
  })

  it("denies writer, narrator, and member", () => {
    expect(editor(makeArgs(makeUser("writer")))).toBe(false)
    expect(editor(makeArgs(makeUser("narrator")))).toBe(false)
    expect(editor(makeArgs(makeUser("member")))).toBe(false)
  })
})

describe("writer helper access", () => {
  it("allows admin, chief-editor, and writer", () => {
    expect(writer(makeArgs(makeUser("admin")))).toBe(true)
    expect(writer(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(writer(makeArgs(makeUser("writer")))).toBe(true)
  })

  it("denies editor (flat role design) unless assigned writer", () => {
    expect(writer(makeArgs(makeUser("editor")))).toBe(false)
  })

  it("denies narrator and member", () => {
    expect(writer(makeArgs(makeUser("narrator")))).toBe(false)
    expect(writer(makeArgs(makeUser("member")))).toBe(false)
  })
})

describe("anyone access helper", () => {
  it("always returns true", () => {
    expect(anyone(makeArgs(null))).toBe(true)
    expect(anyone(makeArgs(makeUser("admin")))).toBe(true)
  })
})

describe("writerOrEditor access helper", () => {
  it("allows admin, chief-editor, editor, and writer", () => {
    expect(writerOrEditor(makeArgs(makeUser("admin")))).toBe(true)
    expect(writerOrEditor(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(writerOrEditor(makeArgs(makeUser("editor")))).toBe(true)
    expect(writerOrEditor(makeArgs(makeUser("writer")))).toBe(true)
  })

  it("denies other roles", () => {
    expect(writerOrEditor(makeArgs(makeUser("narrator")))).toBe(false)
    expect(writerOrEditor(makeArgs(null))).toBe(false)
  })
})

describe("staff access helper", () => {
  it("returns true for staff/admin users", () => {
    expect(staff(makeArgs(makeUser("admin")))).toBe(true)
    expect(staff(makeArgs(makeUser("editor")))).toBe(true)
    expect(staff(makeArgs(makeUser("writer")))).toBe(true)
    expect(staff(makeArgs(makeUser("narrator")))).toBe(true)
  })

  it("returns false for non-staff users", () => {
    expect(staff(makeArgs(makeUser("member")))).toBe(false)
    expect(staff(makeArgs(null))).toBe(false)
  })
})
