import type { FieldAccess, PayloadRequest, RowField, TextField } from "payload"
import { slugField } from "payload"
import { describe, expect, it } from "vitest"

import type { User } from "@/payload-types"

import { deletePageAccess, lockSitePageSlug, sitePageKeyField } from ".."

const req = (roles: User["roles"] | null) =>
  ({ user: roles ? ({ id: 1, roles } as unknown as User) : null }) as unknown as PayloadRequest

const updateOf = (row: RowField, name: string) => {
  const field = row.fields.find((f) => "name" in f && f.name === name) as TextField
  return field.access?.update as FieldAccess
}

const canUpdate = (access: FieldAccess, doc: Record<string, unknown>) =>
  access({ req: req(["admin"]), doc } as Parameters<FieldAccess>[0])

describe("site pages", () => {
  it("lets admins delete any page but a site page, and nobody else delete pages", () => {
    expect(deletePageAccess({ req: req(["admin"]) })).toEqual({ key: { exists: false } })
    expect(deletePageAccess({ req: req(["editor"]) })).toBe(false)
    expect(deletePageAccess({ req: req(null) })).toBe(false)
  })

  it("fixes a site page's slug, and the box that would regenerate it", () => {
    const row = lockSitePageSlug(slugField())
    for (const name of ["slug", "generateSlug"]) {
      const update = updateOf(row, name)
      expect(canUpdate(update, { key: "topics", slug: "topics" }), name).toBe(false)
      expect(canUpdate(update, { key: null, slug: "about" }), name).toBe(true)
    }
  })

  it("keeps the key out of anyone's hands: only a deploy, past access, sets it", () => {
    const access = (sitePageKeyField as TextField).access!
    const args = { req: req(["admin"]) } as Parameters<FieldAccess>[0]
    expect(access.create!(args)).toBe(false)
    expect(access.update!(args)).toBe(false)
  })
})
