// @vitest-environment node
import { describe, expect, it } from "vitest"

import { button } from "../button"
import { namedFields } from "./helpers"

describe("button", () => {
  it("returns a ButtonField group with a link, two color pickers and a variant", () => {
    const field = button()

    expect(field).toMatchObject({
      name: "button",
      type: "group",
      label: "Button",
      interfaceName: "ButtonField",
    })

    const { link, backgroundColor, textColor, variant } = namedFields(field.fields)

    expect(link).toMatchObject({ type: "group", interfaceName: "LinkField" })
    expect(backgroundColor).toMatchObject({ type: "text", label: "Background Color" })
    expect(textColor).toMatchObject({ type: "text", label: "Text Color" })
    expect(variant).toMatchObject({
      type: "select",
      options: ["default", "outline", "ghost", "link"],
      defaultValue: "default",
    })
  })

  it("validates its color pickers as HEX codes", () => {
    const { backgroundColor } = namedFields(button().fields)
    const validate = (backgroundColor as { validate: (v: string, o: object) => unknown }).validate

    expect(validate("#FF5733", {})).toBe(true)
    expect(validate("#F53", {})).toBe(true)
    expect(validate("", {})).toBe(true)
    expect(validate("red", {})).toEqual(expect.stringContaining("valid HEX"))
  })

  it("takes extra group props without letting them rename the field", () => {
    const condition = () => true
    const field = button({
      label: "Call to Action",
      admin: { condition },
      name: "other",
    } as never)

    expect(field).toMatchObject({ name: "button", label: "Call to Action", admin: { condition } })
  })
})
