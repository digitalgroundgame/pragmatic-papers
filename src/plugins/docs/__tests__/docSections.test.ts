import type { Access, FilterOptionsProps, PayloadRequest, RelationshipField } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateDocs } = vi.hoisted(() => ({ revalidateDocs: vi.fn() }))
vi.mock("../revalidateDoc", () => ({ revalidateDocs }))

import { DocSections } from "../docSections"

const req = (roles?: string[], context: Record<string, unknown> = {}) =>
  ({
    user: roles ? { id: 1, collection: "users", roles } : null,
    payload: { logger: {} },
    context,
  }) as unknown as PayloadRequest

beforeEach(() => vi.clearAllMocks())

describe("DocSections access", () => {
  it("lets anyone read them, since the public sidebar does", () => {
    expect((DocSections.access!.read as Access)({ req: req() })).toBe(true)
  })

  it("lets editors, and nobody below, change them", () => {
    for (const operation of ["create", "update", "delete"] as const) {
      const access = DocSections.access![operation] as Access
      expect(access({ req: req(["writer"]) }), operation).toBe(false)
      expect(access({ req: req(["editor"]) }), operation).toBe(true)
    }
  })
})

describe("DocSections fields: parent", () => {
  const field = DocSections.fields.find(
    (f) => "name" in f && f.name === "parent",
  ) as RelationshipField
  const filter = field.filterOptions as (args: Partial<FilterOptionsProps>) => unknown

  it("offers only areas, so sections nest two levels deep", () => {
    expect(filter({})).toEqual({ parent: { exists: false } })
  })

  it("never offers the section itself", () => {
    expect(filter({ id: 4 })).toEqual({
      and: [{ parent: { exists: false } }, { id: { not_equals: 4 } }],
    })
  })
})

describe("DocSections hooks", () => {
  const [afterChange] = DocSections.hooks!.afterChange!
  const [afterDelete] = DocSections.hooks!.afterDelete!
  const run = (hook: unknown, context?: Record<string, unknown>) =>
    (hook as (args: unknown) => unknown)({ doc: { id: 1 }, req: req([], context) })

  it("refresh every docs page when a section is saved or deleted", () => {
    expect(run(afterChange)).toEqual({ id: 1 })
    expect(run(afterDelete)).toEqual({ id: 1 })
    expect(revalidateDocs).toHaveBeenCalledTimes(2)
  })

  it("leave the caches alone for a save that turns revalidation off, like the deploy's seed", () => {
    run(afterChange, { disableRevalidate: true })
    run(afterDelete, { disableRevalidate: true })
    expect(revalidateDocs).not.toHaveBeenCalled()
  })
})
