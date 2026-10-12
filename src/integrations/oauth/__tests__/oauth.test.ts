import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { oauthApp } from "../index"

const app = oauthApp({
  id: "example-sign-in",
  label: "Sign in with Example",
  service: "Example",
  clientIdEnv: "EXAMPLE_CLIENT_ID",
  clientSecretEnv: "EXAMPLE_CLIENT_SECRET",
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("oauthApp", () => {
  it("has no credentials until both variables are set, and names what's missing", () => {
    vi.stubEnv("EXAMPLE_CLIENT_ID", "id")
    vi.stubEnv("EXAMPLE_CLIENT_SECRET", "")

    expect(app.credentials()).toBeNull()
    expect(integrationStatus(app)).toMatchObject({
      configured: false,
      missing: ["EXAMPLE_CLIENT_SECRET"],
      target: "example:oauth",
    })
  })

  it("returns both once they are set", () => {
    vi.stubEnv("EXAMPLE_CLIENT_ID", " id ")
    vi.stubEnv("EXAMPLE_CLIENT_SECRET", "secret")

    expect(app.credentials()).toEqual({ clientId: "id", clientSecret: "secret" })
    expect(integrationStatus(app).configured).toBe(true)
  })
})
