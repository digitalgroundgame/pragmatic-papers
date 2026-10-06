// @vitest-environment node
import { describe, expect, it } from "vitest"

import { userExists } from "../userExists"

const check = (id: number | undefined) => userExists({ id }, {}, {} as never)

describe("userExists", () => {
  it("is true once the user has an id", () => {
    expect(check(1)).toBe(true)
  })

  it("is false for a user that hasn't been saved yet", () => {
    expect(check(undefined)).toBe(false)
  })
})
