import { describe, expect, it, vi } from "vitest"
import {
  canDeleteArticle,
  isSelfOrAdmin,
  isCreatedByOrEditor,
  isDraftOrEditor,
  isPublishedOrStaff,
  readUsers,
} from "../policies"
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

describe("canDeleteArticle policy", () => {
  it("allows admins, chief-editors, and editors", () => {
    expect(canDeleteArticle(makeArgs(makeUser("admin")))).toBe(true)
    expect(canDeleteArticle(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(canDeleteArticle(makeArgs(makeUser("editor")))).toBe(true)
  })

  it("restricts other users to articles they created that aren't live", () => {
    const user = { id: 456, roles: ["writer"] } as unknown as User
    expect(canDeleteArticle(makeArgs(user))).toEqual({
      and: [{ createdBy: { equals: 456 } }, { _status: { not_equals: "published" } }],
    })
  })

  it("denies anonymous users", () => {
    expect(canDeleteArticle(makeArgs(null))).toBe(false)
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
  const writer = { id: 789, roles: ["writer"] } as unknown as User
  const ownOrCredited = {
    or: [{ createdBy: { equals: 789 } }, { authors: { in: [789] } }],
  }

  /** Args for one article, whose latest version `findByID` returns. */
  const forArticle = (user: User, latest: object | null, data?: object) => {
    const findByID = vi.fn().mockResolvedValue(latest)
    const args = { id: 1, req: { user, payload: { findByID } }, data } as unknown as Parameters<
      typeof isDraftOrEditor
    >[0]
    return { args, findByID }
  }

  it("allows admins, chief-editors, and editors", async () => {
    expect(await isDraftOrEditor(makeArgs(makeUser("admin")))).toBe(true)
    expect(await isDraftOrEditor(makeArgs(makeUser("chief-editor")))).toBe(true)
    expect(await isDraftOrEditor(makeArgs(makeUser("editor")))).toBe(true)
  })

  it("restricts writers to documents they created or are credited on", async () => {
    expect(await isDraftOrEditor(makeArgs(writer))).toEqual(ownOrCredited)
  })

  it("denies writers from updating status to published", async () => {
    const args = { req: { user: writer }, data: { _status: "published" } } as unknown as Parameters<
      typeof isDraftOrEditor
    >[0]
    expect(await isDraftOrEditor(args)).toBe(false)
  })

  it("restricts writers to their own documents when update status is draft", async () => {
    const args = { req: { user: writer }, data: { _status: "draft" } } as unknown as Parameters<
      typeof isDraftOrEditor
    >[0]
    expect(await isDraftOrEditor(args)).toEqual(ownOrCredited)
  })

  it("lets a writer update an article whose latest version credits them", async () => {
    const { args, findByID } = forArticle(writer, { createdBy: 5, authors: [4, { id: 789 }] })
    expect(await isDraftOrEditor(args)).toBe(true)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "articles", id: 1, draft: true }),
    )
  })

  it("lets a writer update an article they created", async () => {
    const { args } = forArticle(writer, { createdBy: { id: 789 }, authors: [] })
    expect(await isDraftOrEditor(args)).toBe(true)
  })

  it("keeps a writer out of an article that doesn't credit them, whatever they send", async () => {
    const { args } = forArticle(writer, { createdBy: 5, authors: [4] }, { authors: [789] })
    expect(await isDraftOrEditor(args)).toBe(false)
  })

  it("denies a writer an article that doesn't exist", async () => {
    const { args } = forArticle(writer, null)
    expect(await isDraftOrEditor(args)).toBe(false)
  })

  it("denies other roles (narrators, members)", async () => {
    expect(await isDraftOrEditor(makeArgs(makeUser("narrator")))).toBe(false)
    expect(await isDraftOrEditor(makeArgs(makeUser("member")))).toBe(false)
  })

  it("denies anonymous users", async () => {
    expect(await isDraftOrEditor(makeArgs(null))).toBe(false)
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

  it("restricts member role to staff users, public profiles and themselves", () => {
    const user = { id: 123, roles: ["member"] } as unknown as User
    expect(readUsers(makeArgs(user))).toEqual({
      or: [
        {
          roles: {
            in: ["admin", "chief-editor", "editor", "writer", "narrator"],
          },
        },
        {
          publicProfile: { equals: true },
        },
        {
          id: { equals: 123 },
        },
      ],
    })
  })

  it("restricts anonymous users to staff users and public profiles", () => {
    expect(readUsers(makeArgs(null))).toEqual({
      or: [
        {
          roles: {
            in: ["admin", "chief-editor", "editor", "writer", "narrator"],
          },
        },
        {
          publicProfile: { equals: true },
        },
      ],
    })
  })
})
