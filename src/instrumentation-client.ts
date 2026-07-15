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
    // Drop errors that originate entirely from scripts we don't ship — browser
    // extensions and Cloudflare-injected code (e.g. the /cdn-cgi/rum beacon that
    // throws `r["@context"].toLowerCase` while parsing our JSON-LD). "Third-party"
    // frames are those not tagged with the `applicationKey` set in next.config.ts.
    // We use the `exclusively` behaviour so any error with at least one first-party
    // frame — i.e. anything touching our own code — is always kept.
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: ["pragmatic-papers"],
      behaviour: "drop-error-if-exclusively-contains-third-party-frames",
    }),
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
