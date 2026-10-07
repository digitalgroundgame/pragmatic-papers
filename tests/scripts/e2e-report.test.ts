import { describe, expect, it } from "vitest"

import { onlyNewBaselinesFailed } from "../../scripts/e2e-report.mjs"

const NEW_BASELINE =
  "A snapshot doesn't exist at /repo/tests/e2e/__screenshots__/home.spec.ts/home.png, writing actual."

const result = (...messages: string[]) => ({
  status: messages.length ? "failed" : "passed",
  errors: messages.map((message) => ({ message })),
})

const test = (status: string, ...results: ReturnType<typeof result>[]) => ({ status, results })

/** A report with one file, whose tests sit in a nested describe. */
const report = (tests: ReturnType<typeof test>[], errors: { message: string }[] = []) => ({
  errors,
  suites: [{ specs: [], suites: [{ specs: tests.map((t) => ({ tests: [t] })) }] }],
})

describe("onlyNewBaselinesFailed", () => {
  it("is true when every failure is a baseline the run wrote", () => {
    expect(
      onlyNewBaselinesFailed(
        report([
          test("unexpected", result(NEW_BASELINE)),
          test("unexpected", result(NEW_BASELINE, NEW_BASELINE)),
          test("expected", result()),
          test("flaky", result("Timed out"), result()),
        ]),
      ),
    ).toBe(true)
  })

  it("is false when a test that wrote a baseline also failed an assertion", () => {
    expect(
      onlyNewBaselinesFailed(
        report([test("unexpected", result(NEW_BASELINE, "expect(locator).toBeVisible() failed"))]),
      ),
    ).toBe(false)
  })

  it("is false when another test failed for real", () => {
    expect(
      onlyNewBaselinesFailed(
        report([
          test("unexpected", result(NEW_BASELINE)),
          test("unexpected", result("Error"), result("Error"), result("Error")),
        ]),
      ),
    ).toBe(false)
  })

  it("is false for a mismatch against an existing baseline", () => {
    expect(
      onlyNewBaselinesFailed(
        report([test("unexpected", result("Screenshot comparison failed: 1200 pixels differ"))]),
      ),
    ).toBe(false)
  })

  it("is false when the run itself errored", () => {
    expect(
      onlyNewBaselinesFailed(
        report([test("unexpected", result(NEW_BASELINE))], [{ message: "globalSetup failed" }]),
      ),
    ).toBe(false)
  })

  it("is false when nothing failed", () => {
    expect(onlyNewBaselinesFailed(report([test("expected", result())]))).toBe(false)
  })
})
