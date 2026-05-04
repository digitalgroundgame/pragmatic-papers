import { success, failure, isSuccess, isFailure, type Result } from "./results"

describe("results", () => {
  describe("success", () => {
    it("creates a Success with correct value", () => {
      const result = success(42)
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
    })

    it("works with string values", () => {
      const result = success("hello")
      expect(result.value).toBe("hello")
    })

    it("works with object values", () => {
      const result = success({ a: 1 })
      expect(result.value).toEqual({ a: 1 })
    })
  })

  describe("failure", () => {
    it("creates a Failure with correct error", () => {
      const result: Result<unknown, string> = failure("something went wrong")
      expect(result.success).toBe(false)
      expect(result.error).toBe("something went wrong")
    })

    it("works with Error objects", () => {
      const err = new Error("fail")
      const result: Result<unknown, Error> = failure(err)
      expect(result.error).toBe(err)
    })
  })

  describe("isSuccess", () => {
    it("returns true for Success", () => {
      expect(isSuccess(success(1))).toBe(true)
    })

    it("returns false for Failure", () => {
      expect(isSuccess(failure("err"))).toBe(false)
    })
  })

  describe("isFailure", () => {
    it("returns true for Failure", () => {
      expect(isFailure(failure("err"))).toBe(true)
    })

    it("returns false for Success", () => {
      expect(isFailure(success(1))).toBe(false)
    })
  })

  it("enables type narrowing after isSuccess guard", () => {
    const result: Result<number, string> = success(10)
    if (isSuccess(result)) {
      expect(result.value).toBe(10)
    } else {
      throw new Error("should not reach here")
    }
  })
})
