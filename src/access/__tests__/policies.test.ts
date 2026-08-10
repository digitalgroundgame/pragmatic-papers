import { describe, expect, it } from "vitest"
import {
  isSelfOrAdmin,
  isCreatedByOrEditor,
  isDraftOrEditor,
  isPublishedOrStaff,
  readUsers,
} from "../policies"
import { BYLINE_ROLES, isStaff, PUBLIC_PROFILE_ROLES } from "../roles"
import type { User } from "@/payload-types"
import type { AccessArgs } from "payload"

const makeUser = (roleOrRoles?: string | string[] | null): User => {
  if (!roleOrRoles) return { roles: [] } as unknown as User
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return { roles } as unknown as User
}

const makeArgs = (user: User | null) => ({ req: { user } }) as AccessArgs<User>

describe("isSelfOrAdmin policy", () => {
  it("allows admins and chief-editors", () => {
    expect(isSelfOrAdmin(makeArgs(makeUser("admin")))).toBe(true)
    expect(isSelfOrAdmin(makeArgs(makeUser("chief-editor")))).toBe(true)
  })

  it("restricts other users to their own documents", () => {
    const user = { id: 123, roles: ["writer"] } as unknown as User
    expect(isSelfOrAdmin(makeArgs(user))).toEqual({
      id: {
        equals: 123,
      },
    })
  })

  it("denies anonymous users", () => {
    expect(isSelfOrAdmin(makeArgs(null))).toBe(false)
  })
})

describe("isCreatedByOrEditor policy", () => {
  it("allows admins, chief-editors, and editors", () => {
    expect(isCreatedByOrEditor(makeArgs(makeUser("admin")))).toBe(true)
    expect(isCreatedByOrEditor(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(isCreatedByOrEditor(makeArgs(makeUser("editor")))).toBe(true)
  })

  it("restricts other users to documents they created", () => {
    const user = { id: 456, roles: ["writer"] } as unknown as User
    expect(isCreatedByOrEditor(makeArgs(user))).toEqual({
      createdBy: {
        equals: 456,
      },
    })
  })

  it("denies anonymous users", () => {
    expect(isCreatedByOrEditor(makeArgs(null))).toBe(false)
  })
})

describe("isDraftOrEditor policy", () => {
  it("allows admins, chief-editors, and editors", () => {
    expect(isDraftOrEditor(makeArgs(makeUser("admin")))).toBe(true)
    expect(isDraftOrEditor(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(isDraftOrEditor(makeArgs(makeUser("editor")))).toBe(true)
  })

  it("restricts writers to documents they created", () => {
    const user = { id: 789, roles: ["writer"] } as unknown as User
    expect(isDraftOrEditor(makeArgs(user))).toEqual({
      createdBy: { equals: 789 },
    })
  })

  it("denies writers from updating status to published", () => {
    const user = { id: 789, roles: ["writer"] } as unknown as User
    const args = { req: { user }, data: { _status: "published" } } as unknown as Parameters<
      typeof isDraftOrEditor
    >[0]
    expect(isDraftOrEditor(args)).toBe(false)
  })

  it("restricts writers to their own documents when update status is draft", () => {
    const user = { id: 789, roles: ["writer"] } as unknown as User
    const args = { req: { user }, data: { _status: "draft" } } as unknown as Parameters<
      typeof isDraftOrEditor
    >[0]
    expect(isDraftOrEditor(args)).toEqual({
      createdBy: { equals: 789 },
    })
  })

  it("denies other roles (narrators, members)", () => {
    expect(isDraftOrEditor(makeArgs(makeUser("narrator")))).toBe(false)
    expect(isDraftOrEditor(makeArgs(makeUser("member")))).toBe(false)
  })

  it("denies anonymous users", () => {
    expect(isDraftOrEditor(makeArgs(null))).toBe(false)
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

describe("readUsers policy", () => {
  it("allows all staff roles to read all users", () => {
    for (const role of ["narrator", "writer", "editor", "chief-editor", "admin"]) {
      expect(readUsers(makeArgs(makeUser(role)))).toBe(true)
    }
  })

  it("does not grant the author role staff-wide read access", () => {
    const user = { id: 123, roles: ["author"] } as unknown as User
    expect(readUsers(makeArgs(user))).not.toBe(true)
  })

  it("restricts member role to public profiles and themselves", () => {
    const user = { id: 123, roles: ["member"] } as unknown as User
    expect(readUsers(makeArgs(user))).toEqual({
      or: [
        {
          roles: {
            in: PUBLIC_PROFILE_ROLES,
          },
        },
        {
          id: { equals: 123 },
        },
      ],
    })
  })

  it("restricts anonymous users to public profiles only", () => {
    expect(readUsers(makeArgs(null))).toEqual({
      or: [
        {
          roles: {
            in: PUBLIC_PROFILE_ROLES,
          },
        },
      ],
    })
  })

  it("exposes inactive authors so their bylines survive losing the writer role", () => {
    expect(PUBLIC_PROFILE_ROLES).toContain("author")
    expect(BYLINE_ROLES).toContain("author")
    // `author` is a credit, not a permission.
    expect(isStaff({ roles: ["author"] } as unknown as User)).toBe(false)
  })
})
