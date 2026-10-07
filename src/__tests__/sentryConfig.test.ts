import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  sentryConfigFromDocument,
  sentryHtmlAttributes,
  sentryRuntimeConfig,
  tracesSampleRateFor,
} from "../sentryConfig"

beforeEach(() => {
  vi.stubEnv("BUILD_ENV", undefined)
  vi.stubEnv("COOLIFY_FQDN", undefined)
  vi.stubEnv("SENTRY_DSN", undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const DSN = "https://key@o1.ingest.sentry.io/2"

describe("sentryRuntimeConfig", () => {
  it("reports as the deploy BUILD_ENV names, read at call time", () => {
    vi.stubEnv("SENTRY_DSN", DSN)
    vi.stubEnv("BUILD_ENV", "staging")
    expect(sentryRuntimeConfig()).toEqual({ dsn: DSN, environment: "staging", pr: undefined })

    vi.stubEnv("BUILD_ENV", "production")
    expect(sentryRuntimeConfig().environment).toBe("production")
  })

  it("tags a preview with its PR number from COOLIFY_FQDN", () => {
    vi.stubEnv("BUILD_ENV", "preview")
    vi.stubEnv("COOLIFY_FQDN", "pr-986.pragmaticpapers.com")
    expect(sentryRuntimeConfig()).toMatchObject({ environment: "preview", pr: "986" })
  })

  it("only tags previews", () => {
    vi.stubEnv("BUILD_ENV", "staging")
    vi.stubEnv("COOLIFY_FQDN", "pr-986.pragmaticpapers.com")
    expect(sentryRuntimeConfig().pr).toBeUndefined()
  })

  it("is development with no DSN when nothing is set", () => {
    vi.stubEnv("SENTRY_DSN", "")
    expect(sentryRuntimeConfig()).toEqual({
      dsn: undefined,
      environment: "development",
      pr: undefined,
    })
  })

  it("ignores NEXT_PUBLIC_SENTRY_DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN)
    expect(sentryRuntimeConfig().dsn).toBeUndefined()
  })
})

describe("sentryHtmlAttributes and sentryConfigFromDocument", () => {
  const onHtml = (attributes: Record<string, string>): HTMLElement => {
    const html = document.createElement("html")
    for (const [name, value] of Object.entries(attributes)) html.setAttribute(name, value)
    return html
  }

  it("hand the server's config to the browser SDK unchanged", () => {
    vi.stubEnv("SENTRY_DSN", DSN)
    vi.stubEnv("BUILD_ENV", "preview")
    vi.stubEnv("COOLIFY_FQDN", "pr-986.pragmaticpapers.com")

    const attributes = sentryHtmlAttributes()
    expect(attributes).toEqual({
      "data-sentry-dsn": DSN,
      "data-sentry-environment": "preview",
      "data-sentry-pr": "986",
    })
    expect(sentryConfigFromDocument(onHtml(attributes))).toEqual(sentryRuntimeConfig())
  })

  it("leave out what isn't set, so the browser SDK stays off without a DSN", () => {
    const attributes = sentryHtmlAttributes()
    expect(attributes).toEqual({ "data-sentry-environment": "development" })
    expect(sentryConfigFromDocument(onHtml(attributes))).toEqual({
      dsn: undefined,
      environment: "development",
      pr: undefined,
    })
  })

  it("reads a page without the attributes as development with no DSN", () => {
    expect(sentryConfigFromDocument(onHtml({}))).toEqual({
      dsn: undefined,
      environment: "development",
      pr: undefined,
    })
  })
})

describe("tracesSampleRateFor", () => {
  it("traces a tenth of readers' page loads", () => {
    expect(tracesSampleRateFor("/")).toBe(0.1)
    expect(tracesSampleRateFor("/about")).toBe(0.1)
    expect(tracesSampleRateFor("/articles/some-article")).toBe(0.1)
  })

  it("traces none of the admin panel", () => {
    expect(tracesSampleRateFor("/admin")).toBe(0)
    expect(tracesSampleRateFor("/admin/collections/articles")).toBe(0)
  })

  it("still traces a CMS page whose slug only starts with admin", () => {
    expect(tracesSampleRateFor("/administration")).toBe(0.1)
  })
})
