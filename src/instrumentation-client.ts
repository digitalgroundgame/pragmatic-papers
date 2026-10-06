// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { sentryConfigFromDocument } from "./sentryConfig"
import { sentryIgnoredErrors } from "./sentryIgnoredErrors"

// Both root layouts write the server's config onto <html> (sentryHtmlAttributes), which the
// parser has read before this runs. No DSN there, no reporting, as with SENTRY_DSN unset.
const { dsn, environment, pr } = sentryConfigFromDocument(document.documentElement)

Sentry.init({
  dsn,
  environment,
  initialScope: pr ? { tags: { pr } } : undefined,

  tracesSampleRate: 0.1,

  // Bodies skip the key-based filtering headers and cookies get, so a login would send its
  // password; DB query data includes returned rows, e.g. users' hashes and reset tokens.
  dataCollection: {
    httpBodies: [],
    databaseQueryData: false,
    stackFrameVariables: false,
  },

  ignoreErrors: sentryIgnoredErrors,

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
    // stream in the meantime with `!third_party_code:True`.
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: ["pragmatic-papers"],
      behaviour: "apply-tag-if-exclusively-contains-third-party-frames",
    }),
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
