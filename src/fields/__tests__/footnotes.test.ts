// @vitest-environment node
import type { FieldHook, GroupField } from "payload"
import { describe, expect, it } from "vitest"

import { footnoteFields, footnotesArrayField } from "../footnotes"
import { namedFields, showsFor } from "./helpers"

const linkOf = (fields = footnoteFields()) => fields[3]

const prependHttps = (value: unknown, type = "custom") => {
  const { url } = namedFields(linkOf().fields)
  const [hook] = (url as { hooks: { beforeValidate: FieldHook[] } }).hooks.beforeValidate
  return hook!({ value, siblingData: { type } } as never)
}

describe("footnoteFields", () => {
  it("returns note, index, attribution toggle and attribution link", () => {
    const [note, index, attributionEnabled, link] = footnoteFields()

    expect(note).toMatchObject({ name: "note", type: "textarea", required: true })
    expect(index).toMatchObject({ name: "index", type: "number", admin: { hidden: true } })
    expect(attributionEnabled).toMatchObject({
      name: "attributionEnabled",
      type: "checkbox",
      defaultValue: false,
    })
    expect(link).toMatchObject({ name: "link", type: "group", label: "Attribution Link" })
  })

  it("defaults the attribution link to a custom URL opening in a new tab, with no label", () => {
    const { type, newTab, label } = namedFields(linkOf().fields)

    expect(type).toMatchObject({ defaultValue: "custom" })
    expect(newTab).toMatchObject({ defaultValue: true })
    expect(label).toMatchObject({ admin: { hidden: true } })
  })

  it("shows the link only when attribution is on, unless the condition is overridden", () => {
    expect(showsFor(linkOf(), { attributionEnabled: true })).toBe(true)
    expect(showsFor(linkOf(), { attributionEnabled: false })).toBe(false)

    const custom = footnoteFields({ component: { link: { admin: { condition: () => true } } } })
    expect(showsFor(linkOf(custom), { attributionEnabled: false })).toBe(true)
  })

  it("merges admin overrides into note and attribution toggle", () => {
    const [note, , attributionEnabled] = footnoteFields({
      component: {
        note: { admin: { rows: 6 } },
        attributionEnabled: { admin: { description: "Cite it" } },
      },
    })

    expect(note.admin).toMatchObject({ rows: 6, placeholder: "Enter footnote text here..." })
    expect(attributionEnabled.admin).toMatchObject({ description: "Cite it" })
  })

  describe("custom URL hook", () => {
    it("adds https:// to a bare domain and trims it", () => {
      expect(prependHttps("  example.com/page ")).toBe("https://example.com/page")
    })

    it("keeps URLs that already have a scheme", () => {
      expect(prependHttps(" https://example.com ")).toBe("https://example.com")
      expect(prependHttps("http://example.com")).toBe("http://example.com")
      expect(prependHttps("HTTPS://EXAMPLE.COM")).toBe("HTTPS://EXAMPLE.COM")
    })

    it("leaves blank, non-string and internal-link values alone", () => {
      expect(prependHttps("   ")).toBe("   ")
      expect(prependHttps(undefined)).toBeUndefined()
      expect(prependHttps(42)).toBe(42)
      expect(prependHttps("example.com", "reference")).toBe("example.com")
    })
  })
})

describe("footnotesArrayField", () => {
  it("returns a read-only FootnotesField array of footnote fields", () => {
    const field = footnotesArrayField()

    expect(field).toMatchObject({
      name: "footnotes",
      interfaceName: "FootnotesField",
      type: "array",
      admin: {
        components: { Field: "@/blocks/Footnote/FootnotesPreview#FootnotesPreview" },
      },
    })
    expect(field.fields.map((f) => ("name" in f ? f.name : f.type))).toEqual([
      "note",
      "index",
      "attributionEnabled",
      "link",
    ])
    expect((field.fields[3] as GroupField).label).toBe("Attribution Link")
    expect(field.access?.update?.({} as never)).toBe(false)
  })

  it("is shown only once the document has footnotes", () => {
    const condition = footnotesArrayField().admin!.condition!

    expect(condition({ footnotes: [{ note: "a" }] }, {}, {} as never)).toBe(true)
    expect(condition({ footnotes: [] }, {}, {} as never)).toBe(false)
    expect(condition({}, {}, {} as never)).toBe(false)
  })
})
