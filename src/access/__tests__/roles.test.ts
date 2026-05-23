import { describe, expect, it } from "vitest"
import { hasRole, isAdmin, isStaff, admin, editor, writer } from "@/access/roles"
import type { User } from "@/payload-types"
import type { AccessArgs } from "payload"
import { isPublishedOrStaff } from "../policies"

const makeUser = (roleOrRoles?: string | string[] | null): User => {
  if (!roleOrRoles) return { roles: [] } as unknown as User
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return { roles } as unknown as User
}

const makeArgs = (user: User | null) => ({ req: { user } }) as AccessArgs<User>

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
})

describe("hasRole", () => {
  it("allows admin/chief-editor automatically", () => {
    expect(hasRole(makeUser("admin"), "writer")).toBe(true)
    expect(hasRole(makeUser("chief-editor"), "writer")).toBe(true)
    expect(hasRole(makeUser("admin"), "editor")).toBe(true)
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

describe("isPublishedOrStaff policy", () => {
  it("allows all staff roles to read all documents", () => {
    for (const role of ["narrator", "writer", "editor", "chief-editor", "admin"]) {
      expect(isPublishedOrStaff(makeArgs(makeUser(role)))).toBe(true)
    }
  })

  it("restricts member role to published documents", () => {
    expect(isPublishedOrStaff(makeArgs(makeUser("member")))).toEqual({
      _status: {
        equals: "published",
      },
    })
  })

  it("restricts anonymous users to published documents", () => {
    expect(isPublishedOrStaff(makeArgs(null))).toEqual({
      _status: {
        equals: "published",
      },
    })
  })
})
