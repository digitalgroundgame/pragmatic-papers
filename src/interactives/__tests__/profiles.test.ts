import { describe, expect, it } from "vitest"

import { getProfile, profileKind, profileOptions } from "../profiles"

describe("profiles", () => {
  it("names the kind each profile draws", () => {
    expect(profileKind("federal-courts")).toBe("drilldown")
    expect(profileKind("whip-count")).toBe("whip-count")
    expect(profileKind("nope")).toBeNull()
    expect(profileKind(undefined)).toBeNull()
  })

  it("hands out drilldown profiles only, which the sync and the map read", () => {
    expect(getProfile("federal-courts")?.id).toBe("federal-courts")
    expect(getProfile("whip-count")).toBeNull()
  })

  it("lists every kind for the admin's select", () => {
    expect(profileOptions().map((option) => option.value)).toEqual(["federal-courts", "whip-count"])
  })
})
