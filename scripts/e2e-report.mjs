// Reads Playwright's JSON report (playwright.config.ts writes one when
// E2E_JSON_REPORT is set) for scripts/test-e2e.mjs.
/* eslint-disable @typescript-eslint/explicit-module-boundary-types -- typed with JSDoc */

/** What Playwright says when `--update-snapshots=missing` writes a baseline. */
const NEW_BASELINE = /A snapshot doesn't exist at .*, writing actual\./

function* tests(suite) {
  for (const spec of suite.specs ?? []) yield* spec.tests ?? []
  for (const child of suite.suites ?? []) yield* tests(child)
}

/**
 * True when the run failed only because it wrote missing baselines: at least
 * one test failed, and every error of every failed test is a baseline it
 * wrote. Playwright reports that error as a soft one, so the rest of the test
 * still ran and any real failure in it shows up beside it.
 * @param {{ errors?: unknown[], suites: object[] }} report Playwright's JSON report
 * @returns {boolean}
 */
export function onlyNewBaselinesFailed(report) {
  if (report.errors?.length) return false
  const failed = report.suites
    .flatMap((suite) => [...tests(suite)])
    .filter((test) => test.status === "unexpected")
  return (
    failed.length > 0 &&
    failed.every((test) =>
      test.results.every(
        (result) =>
          result.errors.length > 0 &&
          result.errors.every((error) => NEW_BASELINE.test(error.message ?? "")),
      ),
    )
  )
}
