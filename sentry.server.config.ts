// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Resolved once in next.config.ts from BUILD_ENV; PR previews report `preview`, tagged
  // with their PR number.
  environment: process.env.SENTRY_ENVIRONMENT,
  initialScope: process.env.SENTRY_PR ? { tags: { pr: process.env.SENTRY_PR } } : undefined,

  tracesSampleRate: 0.1,

  // Bodies skip the key-based filtering headers and cookies get, so a login would send its
  // password; DB query data includes returned rows, e.g. users' hashes and reset tokens.
  dataCollection: {
    httpBodies: [],
    databaseQueryData: false,
    stackFrameVariables: false,
  },
})
