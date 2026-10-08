import { prNumberFromFqdn } from "./utilities/prNumberFromFqdn"

/**
 * What every Sentry SDK here (server, edge, browser) reports with. Read when the server
 * runs rather than compiled into the build, so one image reports as whichever
 * deployment runs it.
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

/** Whether a page is Payload's admin panel. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

/**
 * Decides whether the browser traces a page load, which also decides whether its web vitals
 * reach Sentry. None in the admin panel: editors keep it open for hours while lists and
 * forms load and resize, and its page loads were counted among the CMS pages' (`/:slug`)
 * layout shift, where only readers' pages belong. Its errors are still reported.
 *
 * A sampler rather than `tracesSampleRate`, because the page-load span continues the trace
 * the server wrote into the page (`<meta name="sentry-trace">`), and an inherited decision
 * overrides `tracesSampleRate`. A sampler is asked first, so the admin panel can refuse a
 * trace the server sampled, while every other page keeps following the server's decision.
 */
export function tracesSamplerFor(
  pathname: string,
): (context: { inheritOrSampleWith: (fallbackSampleRate: number) => number }) => number {
  const admin = isAdminPath(pathname)
  return ({ inheritOrSampleWith }) => (admin ? 0 : inheritOrSampleWith(0.1))
}
