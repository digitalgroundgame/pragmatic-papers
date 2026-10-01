import type { Field, GroupField, RowField } from "payload"
import { describe, expect, it } from "vitest"

import { link } from "@/fields/link"

const named = (fields: Field[], name: string) => {
  const field = fields.find((candidate) => "name" in candidate && candidate.name === name)
  if (!field) throw new Error(`No field named "${name}"`)
  return field
}

describe("link", () => {
  it("lays the reference and url fields out at half width beside the label", () => {
    const group = link() as GroupField
    const row = group.fields[1] as RowField

    expect(row.type).toBe("row")
    expect(row.fields.map((field) => "name" in field && field.name)).toEqual([
      "reference",
      "url",
      "label",
    ])
    for (const name of ["reference", "url", "label"]) {
      expect(named(row.fields, name).admin).toMatchObject({ width: "50%" })
    }
  })

  it("keeps each link type's condition when it adds the width", () => {
    const row = (link() as GroupField).fields[1] as RowField
    const reference = named(row.fields, "reference")
    const url = named(row.fields, "url")

    expect(reference.admin?.condition?.({}, { type: "reference" }, {} as never)).toBe(true)
    expect(reference.admin?.condition?.({}, { type: "custom" }, {} as never)).toBe(false)
    expect(url.admin?.condition?.({}, { type: "custom" }, {} as never)).toBe(true)
    expect(url.admin?.condition?.({}, { type: "reference" }, {} as never)).toBe(false)
  })

  it("leaves the reference and url fields full width when the label is disabled", () => {
    const group = link({ disableLabel: true }) as GroupField

    expect(group.fields.some((field) => "name" in field && field.name === "label")).toBe(false)
    for (const name of ["reference", "url"]) {
      expect(named(group.fields, name).admin).not.toHaveProperty("width")
    }
  })
})
