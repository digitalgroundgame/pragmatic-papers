import { describe, expect, it } from "vitest"

import { resolveSentryDeployment } from "../deployment"

describe("resolveSentryDeployment", () => {
  it("names the environment after BUILD_ENV", () => {
    expect(resolveSentryDeployment({ BUILD_ENV: "production" })).toEqual({
      environment: "production",
      pr: "",
    })
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "staging",
        COOLIFY_FQDN: "staging.pragmaticpapers.com",
      }),
    ).toEqual({ environment: "staging", pr: "" })
  })

  it("reports a preview as `preview`, tagged with its PR", () => {
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "preview",
        COOLIFY_FQDN: "pr-986.pragmaticpapers.com",
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
    expect(resolveSentryDeployment({ BUILD_ENV: "preview" }).pr).toBe("")
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "preview",
        COOLIFY_FQDN: "staging.pragmaticpapers.com",
      }).pr,
    ).toBe("")
  })

  it("only tags previews", () => {
    expect(
      resolveSentryDeployment({
        BUILD_ENV: "staging",
        COOLIFY_FQDN: "pr-986.pragmaticpapers.com",
      }).pr,
    ).toBe("")
  })

  it("falls back to `development` when BUILD_ENV is unset or blank", () => {
    expect(resolveSentryDeployment({}).environment).toBe("development")
    expect(resolveSentryDeployment({ BUILD_ENV: "" }).environment).toBe("development")
  })
})
