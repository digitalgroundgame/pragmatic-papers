// Payload's errors in Sentry. Payload catches every error its REST API and admin requests
// throw, logs it through its pino logger and answers with JSON, so none of them reach
// `onRequestError` (src/instrumentation.ts). Two things report them instead:
//
// - The pino integration (sentry.server.config.ts) reports every `error`-level log line.
//   Payload already logs the routine failures (`ValidationError`, `Forbidden`, `NotFound`,
//   `Locked`, `MissingFile`) at `info`, so an error-level line is one worth looking at: a
//   `QueryError`, or a failure Payload logs and then recovers from, such as an invalid
//   relationship filter on save. Tune a noisy class with `loggingLevels` in the Payload config.
// - The Sentry plugin's `afterError` hook reports every error Payload answers with a 5xx,
//   with the signed-in user attached, which a log line can't carry.
//
// Payload logs an error before it runs `afterError`, and Sentry reports an error object only
// once, so a 5xx would reach Sentry from the log line, without its user, and the plugin's
// report would be dropped. `skipPluginErrorsInPino` keeps those errors from the pino
// integration.

import { sentryPlugin } from "@payloadcms/plugin-sentry"
import * as Sentry from "@sentry/nextjs"
import type { Plugin } from "payload"

// The plugin's admin provider is a Sentry `ErrorBoundary` with no fallback, imported from
// `@sentry/nextjs` at the top of the admin's bundle. The browser SDK loads lazily
// (src/sentryClient.ts), so it would drop a crash on first render, and it would render a
// blank admin where Next's global error page (src/app/global-error.tsx) already reports the
// crash and shows something. It also sits outside the boundaries Payload puts around fields,
// so it never sees the crashes they catch. Ours takes its slot: it attaches the user, and
// instrumentation-client.ts reports the crashes, caught or not.
const ADMIN_ERROR_BOUNDARY = "@payloadcms/plugin-sentry/client#AdminErrorBoundary"
const ADMIN_SENTRY_PROVIDER = "@/providers/AdminSentryProvider#AdminSentryProvider"

/** The status the plugin reports an error under, as it reads it: no status means a 500. */
function pluginStatus(error: unknown): number {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === "number" ? status : 500
}

/** The client's address from an `X-Forwarded-For` value: its first entry. */
export function clientIp(forwardedFor: string | null | undefined): string | undefined {
  return forwardedFor?.split(",")[0]?.trim() || undefined
}

/**
 * @payloadcms/plugin-sentry: reports Payload's 5xx responses with the user who hit them, and
 * attaches that user to what the admin panel reports from the browser.
 */
export const sentryPayloadPlugin: Plugin = (config) => {
  const withSentry = sentryPlugin({
    options: {
      // The plugin sends `X-Forwarded-For` whole, and behind Cloudflare and Coolify's proxy
      // that is a list, which Sentry drops as an invalid IP. The first entry is the client.
      context: ({ defaultContext }) =>
        defaultContext.user
          ? {
              ...defaultContext,
              user: {
                ...defaultContext.user,
                ip_address: clientIp(defaultContext.user.ip_address),
              },
            }
          : defaultContext,
    },
    Sentry,
  })(config)
  return {
    ...withSentry,
    admin: {
      ...withSentry.admin,
      components: {
        ...withSentry.admin?.components,
        providers: withSentry.admin?.components?.providers?.map((provider) =>
          provider === ADMIN_ERROR_BOUNDARY ? ADMIN_SENTRY_PROVIDER : provider,
        ),
      },
    },
    // The plugin replaces `hooks` with its `afterError` alone; keep any others.
    hooks: { ...config.hooks, afterError: withSentry.hooks?.afterError },
  }
}

const PINO_ERROR_LEVEL = 50

// Where Sentry marks an error object it has reported, so it doesn't report it again
// (`checkOrSetAlreadyCaught` in @sentry/core). Not public API: if a Sentry upgrade renames it,
// a 5xx is reported from its log line without the user, and sentryPayload.test.ts fails.
const SENTRY_CAPTURED = "__sentry_captured__"

/**
 * A pino `logMethod` hook for Payload's logger: an error Payload logs on its way to answering
 * with a 5xx is written to the log as usual, but left to the plugin to report (see the top of
 * this file), by marking it reported while it is logged. Payload's `logError` logs it as
 * `{ err }` and nothing else, which only Payload does here. It also logs that way when an auth
 * strategy throws, which `afterError` never sees; the request carries on signed out, and
 * whatever then fails is reported.
 *
 * Marking the error rather than untracking the logger (`pinoIntegration.untrackLogger`):
 * that keys on a symbol of the integration's own module, and Next bundles the Sentry SDK the
 * integration runs in (instrumentation) apart from the copy Payload's routes import.
 */
export function skipPluginErrorsInPino(
  this: object,
  args: [unknown, ...unknown[]],
  method: (...args: [unknown, ...unknown[]]) => void,
  level: number,
): void {
  const [logged] = args
  const err =
    level === PINO_ERROR_LEVEL &&
    args.length === 1 &&
    typeof logged === "object" &&
    logged !== null &&
    Object.keys(logged).length === 1 &&
    "err" in logged &&
    typeof logged.err === "object" &&
    logged.err !== null &&
    pluginStatus(logged.err) >= 500 &&
    !(SENTRY_CAPTURED in logged.err)
      ? logged.err
      : undefined
  if (!err) {
    method.apply(this, args)
    return
  }
  try {
    Object.defineProperty(err, SENTRY_CAPTURED, { configurable: true, value: true })
  } catch {
    // A frozen error: the log line reports it, without the user.
  }
  try {
    method.apply(this, args)
  } finally {
    Reflect.deleteProperty(err, SENTRY_CAPTURED)
  }
}
