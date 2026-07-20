// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  enableLogs: true,

  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  integrations: [
    // Identify errors that originate entirely from scripts we don't ship — browser
    // extensions and Cloudflare-injected code (e.g. the /cdn-cgi/rum beacon that
    // throws `r["@context"].toLowerCase` while parsing our JSON-LD). "Third-party"
    // frames are those not tagged with the `applicationKey` set in next.config.ts.
    //
    // Rollout is deliberately two-step. We start with `apply-tag-*`, which drops
    // NOTHING and only adds a `third_party_code: true` tag — because if the
    // applicationKey metadata failed to inject (notably on the Turbopack loader
    // path), a `drop-*` behaviour would classify every frame as third-party and
    // silently drop ALL client errors. Once we've confirmed in Sentry that real
    // errors are untagged and third-party ones are tagged, flip this to
    // `drop-error-if-exclusively-contains-third-party-frames`. Filter the issue
    // stream in the meantime with `!third_party_code:True`. See PR/issue #855.
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: ["pragmatic-papers"],
      behaviour: "apply-tag-if-exclusively-contains-third-party-frames",
    }),
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
