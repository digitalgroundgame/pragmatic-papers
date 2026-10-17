// @vitest-environment node
import { describe, expect, it } from "vitest"

import { workerSentryOptions } from "../sentry"

describe("workerSentryOptions", () => {
  it("leaves reporting off without a DSN", () => {
    expect(workerSentryOptions({ BUILD_ENV: "production" })).toBeUndefined()
  })

  it("reports errors only, tagged as the Worker's, under the deploy's environment and commit", () => {
    expect(
      workerSentryOptions({
        SENTRY_DSN: "https://k@o1.ingest.sentry.io/2",
        BUILD_ENV: "production",
        SENTRY_RELEASE: "abc123",
      }),
    ).toEqual({
      dsn: "https://k@o1.ingest.sentry.io/2",
      environment: "production",
      release: "abc123",
      tracesSampleRate: 0,
      initialScope: { tags: { runtime: "worker" } },
    })
  })

  it("defaults to staging, the Worker that came first", () => {
    expect(workerSentryOptions({ SENTRY_DSN: "https://k@o1.ingest.sentry.io/2" })).toMatchObject({
      environment: "staging",
      release: undefined,
    })
  })
})
