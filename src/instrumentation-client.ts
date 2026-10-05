// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Sentry itself loads after the first paint, not here: see sentryClient.ts.

import { startSentryWhenIdle } from "./sentryClient"

export const onRouterTransitionStart = startSentryWhenIdle()
