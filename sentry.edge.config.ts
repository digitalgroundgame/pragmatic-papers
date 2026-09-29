// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
