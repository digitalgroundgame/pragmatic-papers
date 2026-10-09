// @vitest-environment node
import type { GroupField } from "payload"
import { describe, expect, it } from "vitest"

import { link } from "../link"
import { namedFields, showsFor } from "./helpers"

describe("link", () => {
  it("returns a named LinkField group with its defaults", () => {
    const field = link()

    expect(field).toMatchObject({
      name: "link",
      type: "group",
      label: "Link",
      interfaceName: "LinkField",
    })
    expect(Object.keys(namedFields(field.fields))).toEqual([
      "type",
      "newTab",
      "variant",
      "reference",
      "url",
      "label",
    ])
  })

  it("lays out the link's controls with their defaults", () => {
    const { type, newTab, variant, reference, url, label } = namedFields(link().fields)

    expect(type).toMatchObject({ type: "radio", defaultValue: "reference" })
    expect(type).toHaveProperty("options", [
      { label: "Internal link", value: "reference" },
      { label: "Custom URL", value: "custom" },
    ])
    expect(newTab).toMatchObject({ type: "checkbox", label: "Open in new tab" })
    expect(variant).toMatchObject({ type: "select", defaultValue: "link" })
    expect(reference).toMatchObject({
      type: "relationship",
      label: "Document to link to",
      relationTo: ["pages", "volumes", "articles", "topics"],
      required: true,
    })
    expect(url).toMatchObject({ type: "text", label: "Custom URL", required: true })
    expect(label).toMatchObject({ type: "text", label: "Label", required: false })
  })

  it("shows the reference or the URL depending on the link type", () => {
    const { reference, url } = namedFields(link().fields)

    expect(showsFor(reference!, { type: "reference" })).toBe(true)
    expect(showsFor(reference!, { type: "custom" })).toBe(false)
    expect(showsFor(url!, { type: "custom" })).toBe(true)
    expect(showsFor(url!, { type: "reference" })).toBe(false)
  })

  it("takes a name and group props but keeps its own type and interface", () => {
    const field = link({
      name: "cta",
      label: "Call to action",
      required: true,
      admin: { description: "d" },
    }) as GroupField & { name: string }

    expect(field).toMatchObject({
      name: "cta",
      label: "Call to action",
      required: true,
      admin: { description: "d" },
      type: "group",
      interfaceName: "LinkField",
    })
  })

  it("applies component overrides to the fields inside", () => {
    const hook = () => "x"
    const validate = () => true as const
    const field = link({
      component: {
        type: { defaultValue: "custom" },
        newTab: { defaultValue: true, admin: { style: { color: "red" } } },
        reference: { label: "Pick a page" },
        url: { label: "Website", hooks: { beforeValidate: [hook] } },
        label: { label: "Text", validate, admin: { hidden: true } },
        variant: { defaultValue: "outline" },
      },
    })
    const { type, newTab, variant, reference, url, label } = namedFields(field.fields)

    expect(type).toMatchObject({ defaultValue: "custom" })
    expect(newTab).toMatchObject({
      defaultValue: true,
      admin: { style: { alignSelf: "center", marginTop: "12px", color: "red" } },
    })
    expect(variant).toMatchObject({ defaultValue: "outline" })
    expect(reference).toMatchObject({ label: "Pick a page" })
    expect(url).toMatchObject({ label: "Website", hooks: { beforeValidate: [hook] } })
    expect(label).toMatchObject({ label: "Text", validate, admin: { hidden: true } })
  })
})
