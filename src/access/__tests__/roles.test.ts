/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest"
import { atLeast, isStaff, staff } from "@/access/roles"

describe("atLeast", () => {
  const user = (role: string) => ({ role }) as any

  it("returns true when user role equals the required role", () => {
    expect(atLeast(user("admin"), "admin")).toBe(true)
    expect(atLeast(user("editor"), "editor")).toBe(true)
    expect(atLeast(user("writer"), "writer")).toBe(true)
    expect(atLeast(user("narrator"), "narrator")).toBe(true)
    expect(atLeast(user("member"), "member")).toBe(true)
  })

  it("returns true when user role is above the required role", () => {
    expect(atLeast(user("admin"), "editor")).toBe(true)
    expect(atLeast(user("chief-editor"), "editor")).toBe(true)
    expect(atLeast(user("editor"), "writer")).toBe(true)
    expect(atLeast(user("writer"), "narrator")).toBe(true)
    expect(atLeast(user("narrator"), "member")).toBe(true)
  })

  it("returns false when user role is below the required role", () => {
    expect(atLeast(user("member"), "narrator")).toBe(false)
    expect(atLeast(user("narrator"), "writer")).toBe(false)
    expect(atLeast(user("writer"), "editor")).toBe(false)
    expect(atLeast(user("editor"), "admin")).toBe(false)
  })

  it("treats admin and chief-editor as equivalent (both level 4)", () => {
    expect(atLeast(user("admin"), "chief-editor")).toBe(true)
    expect(atLeast(user("chief-editor"), "admin")).toBe(true)
  })

  it("returns false when user has no role", () => {
    expect(atLeast({ role: null } as any, "member")).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(atLeast(undefined as any, "member")).toBe(false)
  })
})

describe("isStaff", () => {
  const user = (role: string) => ({ role }) as any

  it("returns true for all staff roles", () => {
    expect(isStaff(user("admin"))).toBe(true)
    expect(isStaff(user("chief-editor"))).toBe(true)
    expect(isStaff(user("editor"))).toBe(true)
    expect(isStaff(user("writer"))).toBe(true)
    expect(isStaff(user("narrator"))).toBe(true)
  })

  it("returns false for member", () => {
    expect(isStaff(user("member"))).toBe(false)
  })

  it("returns false when user has no role", () => {
    expect(isStaff({ role: null } as any)).toBe(false)
  })

  it("returns false when user is undefined", () => {
    expect(isStaff(undefined as any)).toBe(false)
  })
})

describe("staff (wrapper function)", () => {
  const req = (user: any) => ({ req: { user, payload: {} } }) as any

  it("allows narrator and above", () => {
    for (const role of ["narrator", "writer", "editor", "chief-editor", "admin"]) {
      expect(staff(req({ role })), `Role ${role} should be staff`).toBe(true)
    }
  })

  it("denies member", () => {
    expect(staff(req({ role: "member" }))).toBe(false)
  })

  it("denies unauthenticated", () => {
    expect(staff(req(null))).toBe(false)
  })
})
