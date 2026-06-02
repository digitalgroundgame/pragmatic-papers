import { describe, expect, it } from "vitest"
import {
  hasRole,
  hasRoleOrAdmin,
  isAdmin,
  isStaff,
  admin,
  editor,
  writer,
  anyone,
  authenticated,
  adminFieldLevel,
  editorFieldLevel,
  writerFieldLevel,
  writerOrEditor,
  writerOrEditorFieldLevel,
  staff,
} from "@/access/roles"
import type { User } from "@/payload-types"
import type { AccessArgs, FieldAccess } from "payload"

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

describe("anyone access helper", () => {
  it("always returns true", () => {
    expect(anyone(makeArgs(null))).toBe(true)
    expect(anyone(makeArgs(makeUser("admin")))).toBe(true)
  })
})

describe("authenticated access helper", () => {
  it("returns true if user is logged in", () => {
    expect(authenticated(makeArgs(makeUser("member")))).toBe(true)
  })

  it("returns false if user is not logged in", () => {
    expect(authenticated(makeArgs(null))).toBe(false)
  })
})

describe("adminFieldLevel access helper", () => {
  const makeFieldArgs = (user: User | null) =>
    ({ req: { user } }) as unknown as Parameters<FieldAccess>[0]

  it("allows admin and chief-editor", () => {
    expect(adminFieldLevel(makeFieldArgs(makeUser("admin")))).toBe(true)
    expect(adminFieldLevel(makeFieldArgs(makeUser("chief-editor")))).toBe(true)
  })

  it("denies other roles", () => {
    expect(adminFieldLevel(makeFieldArgs(makeUser("editor")))).toBe(false)
    expect(adminFieldLevel(makeFieldArgs(null))).toBe(false)
  })
})

describe("editorFieldLevel access helper", () => {
  const makeFieldArgs = (user: User | null) =>
    ({ req: { user } }) as unknown as Parameters<FieldAccess>[0]

  it("allows admin, chief-editor, and editor", () => {
    expect(editorFieldLevel(makeFieldArgs(makeUser("admin")))).toBe(true)
    expect(editorFieldLevel(makeFieldArgs(makeUser("chief-editor")))).toBe(true)
    expect(editorFieldLevel(makeFieldArgs(makeUser("editor")))).toBe(true)
  })

  it("denies other roles", () => {
    expect(editorFieldLevel(makeFieldArgs(makeUser("writer")))).toBe(false)
    expect(editorFieldLevel(makeFieldArgs(null))).toBe(false)
  })
})

describe("writerFieldLevel access helper", () => {
  const makeFieldArgs = (user: User | null) =>
    ({ req: { user } }) as unknown as Parameters<FieldAccess>[0]

  it("allows admin, chief-editor, and writer", () => {
    expect(writerFieldLevel(makeFieldArgs(makeUser("admin")))).toBe(true)
    expect(writerFieldLevel(makeFieldArgs(makeUser("chief-editor")))).toBe(true)
    expect(writerFieldLevel(makeFieldArgs(makeUser("writer")))).toBe(true)
  })

  it("denies other roles", () => {
    expect(writerFieldLevel(makeFieldArgs(makeUser("editor")))).toBe(false)
    expect(writerFieldLevel(makeFieldArgs(null))).toBe(false)
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

describe("writerOrEditorFieldLevel access helper", () => {
  const makeFieldArgs = (user: User | null) =>
    ({ req: { user } }) as unknown as Parameters<FieldAccess>[0]

  it("allows admin, chief-editor, editor, and writer", () => {
    expect(writerOrEditorFieldLevel(makeFieldArgs(makeUser("admin")))).toBe(true)
    expect(writerOrEditorFieldLevel(makeFieldArgs(makeUser("chief-editor")))).toBe(true)
    expect(writerOrEditorFieldLevel(makeFieldArgs(makeUser("editor")))).toBe(true)
    expect(writerOrEditorFieldLevel(makeFieldArgs(makeUser("writer")))).toBe(true)
  })

  it("denies other roles", () => {
    expect(writerOrEditorFieldLevel(makeFieldArgs(makeUser("narrator")))).toBe(false)
    expect(writerOrEditorFieldLevel(makeFieldArgs(null))).toBe(false)
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
