/**
 * Stands in for `@sentry/nextjs` in the Cloudflare Worker's server code
 * (`../withCloudflare.ts`). Its server half (Sentry's Node SDK and OpenTelemetry, bundled
 * about three times over) was a large part of the code every new isolate loads, and of its
 * first request's CPU. The Worker reports through `@sentry/cloudflare` instead, which
 * `worker.mjs` starts on each request (`../sentry.ts`), so what the app reports goes there.
 *
 * The browser's copy is untouched. Only what the server code calls is here; webpack warns
 * about any other name a server import asks for.
 */
import { captureException, captureMessage, setUser } from "@sentry/cloudflare"

const noop = (): undefined => undefined

// sentry.server.config.ts and sentry.edge.config.ts: worker.mjs starts the SDK instead.
export const init = noop
export const pinoIntegration = noop

/** src/instrumentation.ts's `onRequestError`: a render or route handler that threw. */
export function captureRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routePath?: string; routeType?: string },
): void {
  captureException(error, {
    tags: { route: context.routePath, routeType: context.routeType },
    extra: { path: request.path, method: request.method },
  })
}

// @payloadcms/plugin-sentry, through src/sentryPayload.ts, and src/sentrySdk.ts, which
// client components import and the server renders too
export { captureException, captureMessage, setUser }
export const captureRouterTransitionStart = noop
