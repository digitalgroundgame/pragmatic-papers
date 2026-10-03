import { describe, expect, it } from "vitest"

import { nestedDocsTrail } from "../trail"

describe("nestedDocsTrail", () => {
  it("turns the plugin's breadcrumbs into a trail, root first", () => {
    expect(
      nestedDocsTrail([
        { label: "Policy", url: "/policy" },
        { label: "Health Care", url: "/policy/health" },
      ]),
    ).toEqual([
      { name: "Policy", path: "/policy" },
      { name: "Health Care", path: "/policy/health" },
    ])
  })

  it("puts a collection's base path in front of the plugin's URLs", () => {
    expect(nestedDocsTrail([{ label: "Courts", url: "/courts" }], "/topics")).toEqual([
      { name: "Courts", path: "/topics/courts" },
    ])
  })

  it("leaves out entries the plugin hasn't filled in", () => {
    expect(
      nestedDocsTrail([
        { label: null, url: "/policy" },
        { label: "Health Care", url: null },
        { label: "Medicaid", url: "/policy/health/medicaid" },
      ]),
    ).toEqual([{ name: "Medicaid", path: "/policy/health/medicaid" }])
  })

  it("is empty for a document with no breadcrumbs", () => {
    expect(nestedDocsTrail(null)).toEqual([])
    expect(nestedDocsTrail(undefined)).toEqual([])
  })
})
