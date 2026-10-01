// @vitest-environment node
import { describe, expect, it } from "vitest"

import { stateOptions } from "../options"

describe("stateOptions", () => {
  it("lists all 50 states", () => {
    expect(stateOptions).toHaveLength(50)
  })

  it("gives every option a label and a two-letter USPS code", () => {
    for (const option of stateOptions) {
      expect(Object.keys(option).sort()).toEqual(["label", "value"])
      expect(option.label.trim()).not.toBe("")
      expect(option.value).toMatch(/^[A-Z]{2}$/)
    }
  })

  it("has no duplicate codes or labels", () => {
    const values = stateOptions.map((o) => o.value)
    const labels = stateOptions.map((o) => o.label)

    expect(new Set(values).size).toBe(values.length)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("is sorted by name", () => {
    const labels = stateOptions.map((o) => o.label)

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
  })

  it("pairs names with the right codes", () => {
    expect(stateOptions).toEqual(
      expect.arrayContaining([
        { label: "California", value: "CA" },
        { label: "New York", value: "NY" },
        { label: "Texas", value: "TX" },
      ]),
    )
  })
})
