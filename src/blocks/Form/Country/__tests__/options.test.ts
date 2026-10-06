// @vitest-environment node
import { describe, expect, it } from "vitest"

import { countryOptions } from "../options"

describe("countryOptions", () => {
  it("gives every option a label and a two-letter uppercase code", () => {
    for (const option of countryOptions) {
      expect(Object.keys(option).sort()).toEqual(["label", "value"])
      expect(option.label.trim()).not.toBe("")
      expect(option.value).toMatch(/^[A-Z]{2}$/)
    }
  })

  it("has no duplicate codes or labels", () => {
    const values = countryOptions.map((o) => o.value)
    const labels = countryOptions.map((o) => o.label)

    expect(new Set(values).size).toBe(values.length)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("lists the countries most readers pick", () => {
    expect(countryOptions).toEqual(
      expect.arrayContaining([
        { label: "United States", value: "US" },
        { label: "Canada", value: "CA" },
        { label: "Mexico", value: "MX" },
      ]),
    )
  })
})
