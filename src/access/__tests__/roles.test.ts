import { describe, expect, it } from "vitest"
import {
  hasRole,
  isAdmin,
  isStaff,
  staff,
  admin,
  editor,
  writer,
  ADMIN_ROLES,
  EDITOR_ROLES,
  WRITER_ROLES,
  STAFF_ROLES,
} from "@/access/roles"
import type { User } from "@/payload-types"
import { isPublishedUnlessStaff } from "../policies"

const makeUser = (role?: User["role"] | string | null): User => ({ role }) as User
const makeArgs = (user: User | null) => ({ req: { user } }) as Parameters<typeof staff>[0]

describe("role groupings", () => {
  it("STAFF_ROLES includes all roles except member (update if new roles are added to User)", () => {
    expect(STAFF_ROLES).toEqual(["admin", "chief-editor", "editor", "writer", "narrator"])
    expect(STAFF_ROLES).not.toContain("member")
  })

  it("ADMIN_ROLES includes admin and chief-editor only (update if new roles are added to User)", () => {
    expect(ADMIN_ROLES).toEqual(["admin", "chief-editor"])
    expect(ADMIN_ROLES).not.toContain("editor")
    expect(ADMIN_ROLES).not.toContain("writer")
    expect(ADMIN_ROLES).not.toContain("narrator")
    expect(ADMIN_ROLES).not.toContain("member")
  })

  it("EDITOR_ROLES includes admin, chief-editor, and editor only (update if new roles are added to User)", () => {
    expect(EDITOR_ROLES).toEqual(["admin", "chief-editor", "editor"])
    expect(EDITOR_ROLES).not.toContain("writer")
    expect(EDITOR_ROLES).not.toContain("narrator")
    expect(EDITOR_ROLES).not.toContain("member")
  })

  it("WRITER_ROLES includes all roles with content creation rights (update if new roles are added to User)", () => {
    expect(WRITER_ROLES).toEqual(["admin", "chief-editor", "editor", "writer"])
    expect(WRITER_ROLES).not.toContain("narrator")
    expect(WRITER_ROLES).not.toContain("member")
  })
})

describe("hasRole", () => {
  it("returns true when user role is in the allowed roles list", () => {
    expect(hasRole(makeUser("admin"), ADMIN_ROLES)).toBe(true)
    expect(hasRole(makeUser("chief-editor"), ADMIN_ROLES)).toBe(true)
    expect(hasRole(makeUser("editor"), EDITOR_ROLES)).toBe(true)
  })

  it("returns false when user role is not in the allowed roles list", () => {
    expect(hasRole(makeUser("editor"), ADMIN_ROLES)).toBe(false)
    expect(hasRole(makeUser("writer"), EDITOR_ROLES)).toBe(false)
  })

  it("returns false when user has no role", () => {
    expect(hasRole(makeUser(null), ["member"])).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(hasRole(undefined, ["member"])).toBe(false)
  })
})

describe("admin helper", () => {
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

describe("editor helper", () => {
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

describe("writer helper", () => {
  it("allows admin, chief-editor, editor, and writer", () => {
    expect(writer(makeArgs(makeUser("admin")))).toBe(true)
    expect(writer(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(writer(makeArgs(makeUser("editor")))).toBe(true)
    expect(writer(makeArgs(makeUser("writer")))).toBe(true)
  })

  it("denies narrator and member", () => {
    expect(writer(makeArgs(makeUser("narrator")))).toBe(false)
    expect(writer(makeArgs(makeUser("member")))).toBe(false)
  })
})

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

  it("returns false when user has no role", () => {
    expect(isAdmin(makeUser(null))).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(isAdmin(undefined)).toBe(false)
  })
})

describe("isStaff", () => {
  it("returns true for all staff roles", () => {
    expect(isStaff(makeUser("admin"))).toBe(true)
    expect(isStaff(makeUser("chief-editor"))).toBe(true)
    expect(isStaff(makeUser("editor"))).toBe(true)
    expect(isStaff(makeUser("writer"))).toBe(true)
    expect(isStaff(makeUser("narrator"))).toBe(true)
  })

  it("returns false for member", () => {
    expect(isStaff(makeUser("member"))).toBe(false)
  })

  it("returns false when user has no role", () => {
    expect(isStaff(makeUser(null))).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(isStaff(undefined)).toBe(false)
  })
})

describe("staff (wrapper function)", () => {
  it("allows narrator and above", () => {
    for (const role of ["narrator", "writer", "editor", "chief-editor", "admin"]) {
      expect(staff(makeArgs(makeUser(role))), `Role ${role} should be staff`).toBe(true)
    }
  })

  it("denies member", () => {
    expect(staff(makeArgs(makeUser("member")))).toBe(false)
  })

  it("denies unauthenticated", () => {
    expect(staff(makeArgs(null))).toBe(false)
  })
})

describe("isPublishedUnlessStaff policy", () => {
  it("allows all staff roles to read all documents", () => {
    for (const role of ["narrator", "writer", "editor", "chief-editor", "admin"]) {
      expect(isPublishedUnlessStaff(makeArgs(makeUser(role)))).toBe(true)
    }
  })

  it("restricts member role to published documents", () => {
    expect(isPublishedUnlessStaff(makeArgs(makeUser("member")))).toEqual({
      _status: {
        equals: "published",
      },
    })
  })

  it("restricts anonymous users to published documents", () => {
    expect(isPublishedUnlessStaff(makeArgs(null))).toEqual({
      _status: {
        equals: "published",
      },
    })
  })
})
