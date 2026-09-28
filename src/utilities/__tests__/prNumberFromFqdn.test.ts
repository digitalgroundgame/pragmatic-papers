import { describe, expect, it } from "vitest"

import { prNumberFromFqdn } from "../prNumberFromFqdn"

describe("prNumberFromFqdn", () => {
  it("reads the PR number from a preview's host", () => {
    expect(prNumberFromFqdn("pr-986.pragmaticpapers.com")).toBe("986")
  })

  it("returns an empty string for a host that isn't a PR preview", () => {
    expect(prNumberFromFqdn("staging.pragmaticpapers.com")).toBe("")
    expect(prNumberFromFqdn("pr-.pragmaticpapers.com")).toBe("")
    expect(prNumberFromFqdn("")).toBe("")
    expect(prNumberFromFqdn(undefined)).toBe("")
  })
})
