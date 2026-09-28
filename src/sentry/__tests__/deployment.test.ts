import { describe, expect, it } from "vitest"

import { resolveSentryDeployment } from "../deployment"

describe("resolveSentryDeployment", () => {
  it("reports a preview as `preview`, not the staging environment it inherits", () => {
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "preview",
        COOLIFY_FQDN: "pr-986.pragmaticpapers.com",
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging",
        NODE_ENV: "production",
      }),
    ).toEqual({ environment: "preview", pr: "986" })
  })

  it("reads the PR from an FQDN with a scheme", () => {
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "preview",
        COOLIFY_FQDN: "https://pr-12.pragmaticpapers.com",
      }).pr,
    ).toBe("12")
  })

  it("leaves the PR tag empty when the FQDN doesn't name one", () => {
    expect(resolveSentryDeployment({ BUILD_ENV: "preview" })).toEqual({
      environment: "preview",
      pr: "",
    })
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "preview",
        COOLIFY_FQDN: "staging.pragmaticpapers.com",
      }).pr,
    ).toBe("")
  })

  it("uses NEXT_PUBLIC_SENTRY_ENVIRONMENT outside previews", () => {
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "staging",
        COOLIFY_FQDN: "staging.pragmaticpapers.com",
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging",
        NODE_ENV: "production",
      }),
    ).toEqual({ environment: "staging", pr: "" })
  })

  it("falls back to NODE_ENV when NEXT_PUBLIC_SENTRY_ENVIRONMENT is unset or blank", () => {
    expect(resolveSentryDeployment({ NODE_ENV: "development" }).environment).toBe("development")
    expect(
      resolveSentryDeployment({ NEXT_PUBLIC_SENTRY_ENVIRONMENT: "", NODE_ENV: "production" })
        .environment,
    ).toBe("production")
  })
})
