import { describe, expect, it } from "vitest"

import { STAFF_ROLES } from "@/access/roles"

import { STAFF_BADGES, staffBadge } from "../staffBadge"

describe("staffBadge", () => {
  it("names each staff role", () => {
    expect(staffBadge(["admin"])).toEqual({ key: "admin", label: "Admin" })
    expect(staffBadge(["chief-editor"])).toEqual({ key: "chief-editor", label: "Chief editor" })
    expect(staffBadge(["editor"])).toEqual({ key: "editor", label: "Editor" })
    expect(staffBadge(["writer"])).toEqual({ key: "writer", label: "Staff writer" })
    expect(staffBadge(["narrator"])).toEqual({ key: "narrator", label: "Narrator" })
  })

  it("shows the most senior of several roles", () => {
    expect(staffBadge(["narrator", "writer", "editor"])).toMatchObject({ label: "Editor" })
  })

  it("gives readers and accounts without roles none", () => {
    expect(staffBadge(["member"])).toBeNull()
    expect(staffBadge([])).toBeNull()
    expect(staffBadge(undefined)).toBeNull()
  })

  it("has a badge for every staff role", () => {
    expect(STAFF_BADGES.map(([role]) => role).sort()).toEqual([...STAFF_ROLES].sort())
  })
})
