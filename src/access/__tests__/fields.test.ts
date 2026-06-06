import { describe, expect, it } from "vitest"
import {
  adminFieldLevel,
  editorFieldLevel,
  writerFieldLevel,
  writerOrEditorFieldLevel,
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
