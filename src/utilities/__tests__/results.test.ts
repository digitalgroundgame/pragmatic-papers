import { describe, expect, expectTypeOf, it } from "vitest"

import {
  failure,
  isFailure,
  isSuccess,
  success,
  type Failure,
  type Result,
  type Success,
} from "@/utilities/results"

describe("results", () => {
  it("wraps a value in a success", () => {
    expect(success(42)).toEqual({ success: true, value: 42 })
  })

  it("wraps an error in a failure", () => {
    const error = new Error("boom")

    expect(failure(error)).toEqual({ success: false, error })
  })

  it("keeps falsy values and errors intact", () => {
    expect(success(null)).toEqual({ success: true, value: null })
    expect(success(0).value).toBe(0)
    expect(failure("").error).toBe("")
  })

  it("tells a success from a failure", () => {
    expect(isSuccess(success(undefined))).toBe(true)
    expect(isSuccess(failure("nope"))).toBe(false)
    expect(isFailure(failure("nope"))).toBe(true)
    expect(isFailure(success(undefined))).toBe(false)
  })

  it("narrows a Result to the matching branch", () => {
    const result = success("ok") as Result<string, Error>

    if (isSuccess(result)) {
      expectTypeOf(result).toEqualTypeOf<Success<string>>()
    }
    if (isFailure(result)) {
      expectTypeOf(result).toEqualTypeOf<Failure<Error>>()
    }
  })
})
