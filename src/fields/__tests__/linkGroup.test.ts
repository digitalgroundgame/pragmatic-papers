// @vitest-environment node
import type { ArrayField, GroupField, SelectField } from "payload"
import { describe, expect, it } from "vitest"

import { appearanceOptions } from "../link"
import { linkGroup } from "../linkGroup"
import { namedFields } from "./helpers"

const array = (...args: Parameters<typeof linkGroup>) => linkGroup(...args) as ArrayField

describe("linkGroup (deprecated)", () => {
  it("wraps one link in a collapsed links array", () => {
    const field = array()

    expect(field).toMatchObject({ name: "links", type: "array", admin: { initCollapsed: true } })
    expect(field.fields).toHaveLength(1)
    expect(field.fields[0]).toMatchObject({ name: "link", type: "group" })
  })

  it("passes appearances through to the link", () => {
    const link = array({ appearances: ["default"] }).fields[0] as GroupField

    expect((namedFields(link.fields).appearance as SelectField).options).toEqual([
      appearanceOptions.default,
    ])
    expect(
      namedFields((array({ appearances: false }).fields[0] as GroupField).fields),
    ).not.toHaveProperty("appearance")
  })

  it("deep-merges overrides into the array", () => {
    const field = array({ overrides: { maxRows: 2, admin: { description: "d" } } })

    expect(field).toMatchObject({
      name: "links",
      maxRows: 2,
      admin: { initCollapsed: true, description: "d" },
    })
  })
})
