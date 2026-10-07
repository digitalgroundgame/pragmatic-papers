import { describe, expect, it } from "vitest"

import { sentryIgnoredErrors, sentryIgnoredServerErrors } from "../sentryIgnoredErrors"

const ignored = (message: string) => sentryIgnoredErrors.some((pattern) => pattern.test(message))

describe("sentryIgnoredErrors", () => {
  it.each([
    "Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4",
    "Non-Error promise rejection captured with value: Object Not Found Matching Id:12, MethodName:simulateEvent, ParamCount:1",
    "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
    "TypeError: undefined is not an object (evaluating 'window.__firefox__.reader')",
    "Event `Event` (type=error) captured as promise rejection",
    "Event: Event `Event` (type=error) captured as promise rejection",
    "Event `Event` (type=error) captured as exception",
  ])("drops %j", (message) => {
    expect(ignored(message)).toBe(true)
  })

  it.each([
    "Non-Error promise rejection captured with value: undefined",
    "Non-Error promise rejection captured with value: Object Not Found",
    "undefined is not an object (evaluating 'window.MathJax.typeset')",
    "TypeError: Failed to fetch",
    "Event `ErrorEvent` (type=error) captured as promise rejection",
    "Event `Event` (type=abort) captured as promise rejection",
  ])("keeps %j", (message) => {
    expect(ignored(message)).toBe(false)
  })
})

describe("sentryIgnoredServerErrors", () => {
  const ignoredOnServer = (message: string) =>
    sentryIgnoredServerErrors.some((pattern) => pattern.test(message))

  it.each([
    "The router state header was sent but could not be parsed.",
    "Error: The router state header was sent but could not be parsed.",
  ])("drops %j", (message) => {
    expect(ignoredOnServer(message)).toBe(true)
  })

  it.each([
    "The router state header was too large.",
    "Multiple router state headers were sent. This is not allowed.",
    "TypeError: The router state header was sent but could not be parsed.",
  ])("keeps %j", (message) => {
    expect(ignoredOnServer(message)).toBe(false)
  })
})
