import { describe, expect, it } from "vitest"
import {
  adminFieldLevel,
  editorFieldLevel,
  writerFieldLevel,
  writerOrEditorFieldLevel,
  selfOrStaffFieldLevel,
} from "@/access/fields"
import type { User } from "@/payload-types"
import type { FieldAccess } from "payload"

const makeUser = (roleOrRoles?: string | string[] | null): User => {
  if (!roleOrRoles) return { roles: [] } as unknown as User
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return { roles } as unknown as User
}

const makeFieldArgs = (user: User | null) =>
  ({ req: { user } }) as unknown as Parameters<FieldAccess>[0]

describe("adminFieldLevel access helper", () => {
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

describe("writerOrEditorFieldLevel access helper", () => {
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

const makeFieldArgsWithId = (user: User | null, id: string | number | undefined) =>
  ({ req: { user }, id }) as unknown as Parameters<FieldAccess>[0]

describe("selfOrStaffFieldLevel access helper", () => {
  it("allows staff members to read any record", () => {
    for (const role of ["narrator", "writer", "editor", "chief-editor", "admin"]) {
      expect(selfOrStaffFieldLevel(makeFieldArgsWithId(makeUser(role), 999))).toBe(true)
    }
  })

  it("allows user to read their own record", () => {
    const user = { id: 123, roles: ["member"] } as unknown as User
    expect(selfOrStaffFieldLevel(makeFieldArgsWithId(user, 123))).toBe(true)
  })

  it("denies user from reading other record if not staff", () => {
    const user = { id: 123, roles: ["member"] } as unknown as User
    expect(selfOrStaffFieldLevel(makeFieldArgsWithId(user, 999))).toBe(false)
  })

  it("denies anonymous users", () => {
    expect(selfOrStaffFieldLevel(makeFieldArgsWithId(null, 999))).toBe(false)
  })
})
