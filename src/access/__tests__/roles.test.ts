import { describe, expect, it } from "vitest"
import { atLeast, isStaff, staff } from "@/access/roles"
import type { User } from "@/payload-types"

const makeUser = (role?: User["role"] | string | null): User => ({ role }) as User
const makeArgs = (user: User | null) => ({ req: { user } }) as Parameters<typeof staff>[0]

describe("atLeast", () => {
  it("returns true when user role equals the required role", () => {
    expect(atLeast(makeUser("admin"), "admin")).toBe(true)
    expect(atLeast(makeUser("editor"), "editor")).toBe(true)
    expect(atLeast(makeUser("writer"), "writer")).toBe(true)
    expect(atLeast(makeUser("narrator"), "narrator")).toBe(true)
    expect(atLeast(makeUser("member"), "member")).toBe(true)
  })

  it("returns true when user role is above the required role", () => {
    expect(atLeast(makeUser("admin"), "editor")).toBe(true)
    expect(atLeast(makeUser("chief-editor"), "editor")).toBe(true)
    expect(atLeast(makeUser("editor"), "writer")).toBe(true)
    expect(atLeast(makeUser("writer"), "narrator")).toBe(true)
    expect(atLeast(makeUser("narrator"), "member")).toBe(true)
  })

  it("returns false when user role is below the required role", () => {
    expect(atLeast(makeUser("member"), "narrator")).toBe(false)
    expect(atLeast(makeUser("narrator"), "writer")).toBe(false)
    expect(atLeast(makeUser("writer"), "editor")).toBe(false)
    expect(atLeast(makeUser("editor"), "admin")).toBe(false)
  })

  it("treats admin and chief-editor as equivalent (both level 4)", () => {
    expect(atLeast(makeUser("admin"), "chief-editor")).toBe(true)
    expect(atLeast(makeUser("chief-editor"), "admin")).toBe(true)
  })

  it("returns false when user has no role", () => {
    expect(atLeast(makeUser(null), "member")).toBe(false)
  })

  it("returns false when user has an unrecognized role", () => {
    expect(atLeast(makeUser("supervillain"), "member")).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(atLeast(undefined, "member")).toBe(false)
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
