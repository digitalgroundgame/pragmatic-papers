// The parts of the Sentry SDK the browser uses, and its configuration. Only
// sentryClient.ts imports this, lazily: see there for why.

import {
  captureException,
  captureMessage,
  captureRouterTransitionStart,
  init,
  setUser,
} from "@sentry/nextjs"

import { sentryConfigFromDocument, tracesSamplerFor } from "./sentryConfig"
import { sentryIgnoredErrors } from "./sentryIgnoredErrors"
import { thirdPartyFramesIntegration } from "./sentryThirdPartyFrames"

export { captureException, captureMessage, captureRouterTransitionStart, setUser }

export function initSentry(): void {
  // Both root layouts write the server's config onto <html> (sentryHtmlAttributes). No
  // DSN there, no reporting, as with SENTRY_DSN unset.
  const { dsn, environment, pr } = sentryConfigFromDocument(document.documentElement)

  init({
    dsn,
    environment,
    initialScope: pr ? { tags: { pr } } : undefined,

    tracesSampler: tracesSamplerFor(window.location.pathname),

    // Bodies skip the key-based filtering headers and cookies get, so a login would send
    // its password; DB query data includes returned rows, e.g. users' hashes and reset
    // tokens.
    dataCollection: {
      httpBodies: [],
      databaseQueryData: false,
      stackFrameVariables: false,
    },

    ignoreErrors: sentryIgnoredErrors,

    integrations: [
      // Tags errors that come entirely from scripts we don't ship (`third_party_code`), and
      // drops nothing. Once the tag is confirmed to mark only those in Sentry, dropping them
      // is a `return null` from a `beforeSend` that checks it.
      thirdPartyFramesIntegration(),
    ],
  })
}
