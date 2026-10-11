/**
 * Stands in for `@sentry/nextjs` in the Cloudflare Worker's server code
 * (`../withCloudflare.ts`). The Worker has no `SENTRY_DSN`, so the SDK reports nothing
 * there, and its server half (Sentry's Node SDK and OpenTelemetry, bundled about three times
 * over) was a large part of the code every new isolate loads, and of its first request's
 * CPU. Error reporting from a Worker would come from `@sentry/cloudflare`, not this SDK.
 *
 * The browser's copy is untouched. Only what the server code calls is here; webpack warns
 * about any other name a server import asks for.
 */
const noop = (): undefined => undefined

// sentry.server.config.ts and sentry.edge.config.ts
export const init = noop
export const pinoIntegration = noop
// src/instrumentation.ts
export const captureRequestError = noop
// @payloadcms/plugin-sentry, through src/sentryPayload.ts
export const captureException = noop
// src/sentrySdk.ts, which client components import and the server renders too
export const captureMessage = noop
export const captureRouterTransitionStart = noop
export const setUser = noop
