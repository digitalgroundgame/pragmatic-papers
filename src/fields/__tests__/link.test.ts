// @vitest-environment node
import type { GroupField, SelectField } from "payload"
import { describe, expect, it } from "vitest"

import { appearanceOptions, link } from "../link"
import { namedFields, showsFor } from "./helpers"

const group = (...args: Parameters<typeof link>) => link(...args) as GroupField

describe("link (deprecated)", () => {
  it("returns a link group with type, new tab, target, label and appearance", () => {
    const field = group()

    expect(field).toMatchObject({ name: "link", type: "group", admin: { hideGutter: true } })
    expect(Object.keys(namedFields(field.fields))).toEqual([
      "type",
      "newTab",
      "reference",
      "url",
      "label",
      "appearance",
    ])
    expect(namedFields(field.fields).reference).toMatchObject({
      relationTo: ["pages", "volumes", "articles"],
      required: true,
    })
  })

  it("shows the reference or the URL depending on the link type", () => {
    const { reference, url } = namedFields(group().fields)

    expect(showsFor(reference!, { type: "reference" })).toBe(true)
    expect(showsFor(reference!, { type: "custom" })).toBe(false)
    expect(showsFor(url!, { type: "custom" })).toBe(true)
    expect(showsFor(url!, { type: "reference" })).toBe(false)
  })

  it("drops the label field when disableLabel is set", () => {
    const field = group({ disableLabel: true })

    expect(namedFields(field.fields)).not.toHaveProperty("label")
    expect(field.fields.map((f) => ("name" in f ? f.name : f.type))).toEqual([
      "row",
      "reference",
      "url",
      "appearance",
    ])
  })

  it("offers both appearances by default, a chosen subset, or none", () => {
    const appearance = (field: GroupField) => namedFields(field.fields).appearance as SelectField

    expect(appearance(group()).options).toEqual([
      appearanceOptions.default,
      appearanceOptions.outline,
    ])
    expect(appearance(group({ appearances: ["outline"] })).options).toEqual([
      appearanceOptions.outline,
    ])
    expect(appearance(group({ appearances: false }))).toBeUndefined()
  })

  it("deep-merges overrides into the group", () => {
    const field = group({ overrides: { name: "cta", admin: { description: "d" } } })

    expect(field).toMatchObject({ name: "cta", admin: { hideGutter: true, description: "d" } })
  })
})
