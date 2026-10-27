/**
 * Error reporting from the Cloudflare Worker, through `@sentry/cloudflare` (`worker.mjs`
 * wraps both entrypoints). Next's server SDK is swapped for `stubs/sentry.ts` there, which
 * hands what the app reports to this SDK.
 *
 * The browser's SDK needs nothing here: the root layout reads `SENTRY_DSN` and `BUILD_ENV`
 * when the Worker renders it (`sentryHtmlAttributes`), as it does on Coolify.
 */
import type { CloudflareOptions } from "@sentry/cloudflare"

/** The Worker's variables that this module reads. */
export interface SentryEnv {
  SENTRY_DSN?: string
  /** `staging` or `production`, as on Coolify. */
  BUILD_ENV?: string
  /** The commit the deploy built, as the Coolify image reports it. */
  SENTRY_RELEASE?: string
}

/** Sentry's options for one request, or `undefined` (reporting off) without a DSN. */
export function workerSentryOptions(env: SentryEnv): CloudflareOptions | undefined {
  if (!env.SENTRY_DSN) return undefined
  return {
    dsn: env.SENTRY_DSN,
    environment: env.BUILD_ENV || "staging",
    release: env.SENTRY_RELEASE || undefined,
    // Errors only: tracing every request costs CPU on each isolate, and Coolify's
    // server traces already cover the same pages.
    tracesSampleRate: 0,
    // Tells the Worker's errors from Coolify's, which report under the same environment.
    initialScope: { tags: { runtime: "worker" } },
  }
}
