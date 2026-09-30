import { prNumberFromFqdn } from "./utilities/prNumberFromFqdn"

/**
 * What every Sentry SDK here (server, edge, browser) reports with. Read when the server
 * runs rather than compiled into the build, so one image reports as whichever
 * deployment runs it (#1090).
 */
export interface SentryRuntimeConfig {
  dsn?: string
  /** The deploy: `production`, `staging`, `preview`, or `development` locally. */
  environment: string
  /** A preview's PR number, from its COOLIFY_FQDN, so `pr:986` finds one PR's errors. */
  pr?: string
}

/** On the server: from BUILD_ENV, COOLIFY_FQDN and SENTRY_DSN as the process sees them. */
export function sentryRuntimeConfig(): SentryRuntimeConfig {
  const environment = process.env.BUILD_ENV || "development"
  const pr = environment === "preview" ? prNumberFromFqdn(process.env.COOLIFY_FQDN) : ""
  return {
    dsn: process.env.SENTRY_DSN || undefined,
    environment,
    pr: pr || undefined,
  }
}

/**
 * The same config as `data-sentry-*` attributes for a root layout's `<html>`. The browser
 * SDK starts from instrumentation-client.ts, before hydration and before any
 * `beforeInteractive` script has run, but after the parser has read `<html>`.
 */
export function sentryHtmlAttributes(): Record<`data-sentry-${string}`, string> {
  const { dsn, environment, pr } = sentryRuntimeConfig()
  return {
    "data-sentry-environment": environment,
    ...(dsn ? { "data-sentry-dsn": dsn } : {}),
    ...(pr ? { "data-sentry-pr": pr } : {}),
  }
}

/** In the browser: the config the root layout wrote onto `<html>`. */
export function sentryConfigFromDocument(root: HTMLElement): SentryRuntimeConfig {
  const { sentryDsn, sentryEnvironment, sentryPr } = root.dataset
  return {
    dsn: sentryDsn || undefined,
    environment: sentryEnvironment || "development",
    pr: sentryPr || undefined,
  }
}
