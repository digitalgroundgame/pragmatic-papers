import { describe, expect, it } from "vitest"

import { sentryIgnoredErrors } from "../sentryIgnoredErrors"

const ignored = (message: string) => sentryIgnoredErrors.some((pattern) => pattern.test(message))

describe("sentryIgnoredErrors", () => {
  it.each([
    "Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4",
    "Non-Error promise rejection captured with value: Object Not Found Matching Id:12, MethodName:simulateEvent, ParamCount:1",
    "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
    "TypeError: undefined is not an object (evaluating 'window.__firefox__.reader')",
  ])("drops %j", (message) => {
    expect(ignored(message)).toBe(true)
  })

  it.each([
    "Non-Error promise rejection captured with value: undefined",
    "Non-Error promise rejection captured with value: Object Not Found",
    "undefined is not an object (evaluating 'window.MathJax.typeset')",
    "TypeError: Failed to fetch",
  ])("keeps %j", (message) => {
    expect(ignored(message)).toBe(false)
  })
})
