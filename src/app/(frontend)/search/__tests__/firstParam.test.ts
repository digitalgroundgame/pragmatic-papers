import { describe, expect, it } from "vitest"

import { firstParam } from "../firstParam"

describe("firstParam", () => {
  it("returns a parameter given once as it is", () => {
    expect(firstParam("tariffs")).toBe("tariffs")
    expect(firstParam("")).toBe("")
  })

  it("takes the first value of a parameter the URL repeats", () => {
    expect(firstParam(["tariffs", "trade"])).toBe("tariffs")
  })

  it("is undefined for a parameter that's missing or repeated as nothing", () => {
    expect(firstParam(undefined)).toBeUndefined()
    expect(firstParam([])).toBeUndefined()
  })
})
