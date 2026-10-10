import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  isAdminPath,
  prNumberFromFqdn,
  sentryConfigFromDocument,
  sentryHtmlAttributes,
  sentryRuntimeConfig,
  tracesSamplerFor,
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

describe("isAdminPath", () => {
  it("matches the admin panel and nothing that only starts like it", () => {
    expect(isAdminPath("/admin")).toBe(true)
    expect(isAdminPath("/admin/collections/articles")).toBe(true)
    expect(isAdminPath("/administration")).toBe(false)
    expect(isAdminPath("/articles/admin")).toBe(false)
  })
})

describe("tracesSamplerFor", () => {
  // What Sentry passes the sampler: the parent's decision if the page has one (the server's
  // <meta name="sentry-trace">), else the fallback rate.
  const parentSampled = { inheritOrSampleWith: () => 1 }
  const parentDropped = { inheritOrSampleWith: () => 0 }
  const noParent = { inheritOrSampleWith: (rate: number) => rate }

  it("follows the server's decision on readers' pages", () => {
    expect(tracesSamplerFor("/about")(parentSampled)).toBe(1)
    expect(tracesSamplerFor("/about")(parentDropped)).toBe(0)
  })

  it("traces a tenth of readers' page loads the server didn't decide", () => {
    expect(tracesSamplerFor("/")(noParent)).toBe(0.1)
    expect(tracesSamplerFor("/articles/some-article")(noParent)).toBe(0.1)
  })

  it("traces none of the admin panel, even when the server sampled the request", () => {
    expect(tracesSamplerFor("/admin")(parentSampled)).toBe(0)
    expect(tracesSamplerFor("/admin/collections/articles")(parentSampled)).toBe(0)
    expect(tracesSamplerFor("/admin/collections/articles")(noParent)).toBe(0)
  })

  it("still traces a CMS page whose slug only starts with admin", () => {
    expect(tracesSamplerFor("/administration")(parentSampled)).toBe(1)
    expect(tracesSamplerFor("/administration")(noParent)).toBe(0.1)
  })
})

describe("prNumberFromFqdn", () => {
  it("reads the PR number from a preview's host", () => {
    expect(prNumberFromFqdn("pr-986.pragmaticpapers.com")).toBe("986")
  })

  it("returns an empty string for a host that isn't a PR preview", () => {
    expect(prNumberFromFqdn("staging.pragmaticpapers.com")).toBe("")
    expect(prNumberFromFqdn("pr-.pragmaticpapers.com")).toBe("")
    expect(prNumberFromFqdn("")).toBe("")
    expect(prNumberFromFqdn(undefined)).toBe("")
  })
})
