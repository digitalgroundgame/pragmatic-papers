import { describe, expect, it } from "vitest"

import { STAFF_ROLES } from "@/access/roles"

import { STAFF_BADGES, staffBadge } from "../staffBadge"

describe("staffBadge", () => {
  it("names each staff role", () => {
    expect(staffBadge(["admin"])).toBe("Admin")
    expect(staffBadge(["chief-editor"])).toBe("Chief editor")
    expect(staffBadge(["editor"])).toBe("Editor")
    expect(staffBadge(["writer"])).toBe("Staff writer")
    expect(staffBadge(["narrator"])).toBe("Narrator")
  })

  it("shows the most senior of several roles", () => {
    expect(staffBadge(["narrator", "writer", "editor"])).toBe("Editor")
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
