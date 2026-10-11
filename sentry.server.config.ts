// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { sentryRuntimeConfig } from "./src/sentryConfig"

// Read when the server starts: PR previews report `preview`, tagged with their PR number.
const { dsn, environment, pr } = sentryRuntimeConfig()

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

  integrations: [
    // Payload's error-level log lines as issues: the errors it catches and answers with
    // JSON never reach onRequestError. See src/sentryPayload.ts.
    Sentry.pinoIntegration({ error: { levels: ["error", "fatal"] } }),
  ],
})
