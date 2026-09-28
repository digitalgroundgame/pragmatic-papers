import { describe, expect, it } from "vitest"
import { hasRole, hasRoleOrAdmin, isAdmin, isEditor, isStaff } from "@/access/roles"
import type { User } from "@/payload-types"

const makeUser = (roleOrRoles?: string | string[] | null): User => {
  if (!roleOrRoles) return { roles: [] } as unknown as User
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return { roles } as unknown as User
}

describe("isAdmin", () => {
  it("returns true for admin and chief-editor", () => {
    expect(isAdmin(makeUser("admin"))).toBe(true)
    expect(isAdmin(makeUser("chief-editor"))).toBe(true)
  })

  it("returns false for editor, writer, narrator, and member", () => {
    expect(isAdmin(makeUser("editor"))).toBe(false)
    expect(isAdmin(makeUser("writer"))).toBe(false)
    expect(isAdmin(makeUser("narrator"))).toBe(false)
    expect(isAdmin(makeUser("member"))).toBe(false)
  })

  it("returns false when user has no roles", () => {
    expect(isAdmin(makeUser(null))).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(isAdmin(undefined)).toBe(false)
  })

  it("returns false when user is null", () => {
    expect(isAdmin(null)).toBe(false)
  })
})

describe("hasRole", () => {
  it("does NOT allow admin/chief-editor automatically (pure role check)", () => {
    expect(hasRole(makeUser("admin"), "writer")).toBe(false)
    expect(hasRole(makeUser("chief-editor"), "writer")).toBe(false)
    expect(hasRole(makeUser("admin"), "admin")).toBe(true)
  })

  it("returns true when user has the specific role", () => {
    expect(hasRole(makeUser("editor"), "editor")).toBe(true)
    expect(hasRole(makeUser("writer"), "writer")).toBe(true)
  })

  it("returns true if user has any of the target roles", () => {
    expect(hasRole(makeUser("editor"), ["editor", "writer"])).toBe(true)
    expect(hasRole(makeUser("writer"), ["editor", "writer"])).toBe(true)
  })

  it("returns false when user does not have the specific role", () => {
    expect(hasRole(makeUser("editor"), "writer")).toBe(false)
    expect(hasRole(makeUser("writer"), "editor")).toBe(false)
  })

  it("supports overlapping roles", () => {
    const multiUser = makeUser(["writer", "narrator"])
    expect(hasRole(multiUser, "writer")).toBe(true)
    expect(hasRole(multiUser, "narrator")).toBe(true)
    expect(hasRole(multiUser, "editor")).toBe(false)
  })

  it("returns false when user is null or undefined", () => {
    expect(hasRole(null, "writer")).toBe(false)
    expect(hasRole(undefined, "writer")).toBe(false)
  })
})

describe("hasRoleOrAdmin", () => {
  it("allows admin/chief-editor automatically", () => {
    expect(hasRoleOrAdmin(makeUser("admin"), "writer")).toBe(true)
    expect(hasRoleOrAdmin(makeUser("chief-editor"), "writer")).toBe(true)
    expect(hasRoleOrAdmin(makeUser("admin"), "editor")).toBe(true)
  })

  it("returns true when non-admin user has the specific role", () => {
    expect(hasRoleOrAdmin(makeUser("editor"), "editor")).toBe(true)
    expect(hasRoleOrAdmin(makeUser("writer"), "writer")).toBe(true)
  })

  it("returns false when non-admin user does not have the specific role", () => {
    expect(hasRoleOrAdmin(makeUser("editor"), "writer")).toBe(false)
    expect(hasRoleOrAdmin(makeUser("writer"), "editor")).toBe(false)
  })

  it("returns false when user is null or undefined", () => {
    expect(hasRoleOrAdmin(null, "writer")).toBe(false)
    expect(hasRoleOrAdmin(undefined, "writer")).toBe(false)
  })
})

describe("isEditor", () => {
  it("returns true for editor and above (editor, chief-editor, admin)", () => {
    expect(isEditor(makeUser("editor"))).toBe(true)
    expect(isEditor(makeUser("chief-editor"))).toBe(true)
    expect(isEditor(makeUser("admin"))).toBe(true)
  })

  it("returns false for writer, narrator, and member", () => {
    expect(isEditor(makeUser("writer"))).toBe(false)
    expect(isEditor(makeUser("narrator"))).toBe(false)
    expect(isEditor(makeUser("member"))).toBe(false)
  })

  it("returns false when user is null or undefined", () => {
    expect(isEditor(makeUser(null))).toBe(false)
    expect(isEditor(undefined)).toBe(false)
    expect(isEditor(null)).toBe(false)
  })
})

describe("isStaff", () => {
  it("returns true for staff roles and admins", () => {
    expect(isStaff(makeUser("admin"))).toBe(true)
    expect(isStaff(makeUser("chief-editor"))).toBe(true)
    expect(isStaff(makeUser("editor"))).toBe(true)
    expect(isStaff(makeUser("writer"))).toBe(true)
    expect(isStaff(makeUser("narrator"))).toBe(true)
  })

  it("returns false for member", () => {
    expect(isStaff(makeUser("member"))).toBe(false)
  })

  it("returns false when user has no roles", () => {
    expect(isStaff(makeUser(null))).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(isStaff(undefined)).toBe(false)
  })
})
