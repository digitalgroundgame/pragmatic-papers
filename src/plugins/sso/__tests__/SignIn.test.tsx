import type { Payload } from "payload"
import { describe, expect, it, vi } from "vitest"

import { SignIn } from "../components/SignIn"
import { SignInButtons } from "../components/SignInButtons"
import type { ResolvedSsoConfig } from "../types"

const payload = { config: { routes: { api: "/api", admin: "/admin" } } } as unknown as Payload
const credentials = { clientId: "id", clientSecret: "secret" }

const sso = (enabled: boolean, providers: ResolvedSsoConfig["providers"]) =>
  ({ enabled: vi.fn(async () => enabled), providers }) as unknown as ResolvedSsoConfig

describe("SignIn", () => {
  it("renders nothing while single sign-on is off", async () => {
    const config = sso(false, () => ({ google: credentials }))
    expect(await SignIn({ payload, sso: config })).toBeNull()
    expect(config.enabled).toHaveBeenCalledWith({ payload })
  })

  it("renders nothing while no provider has credentials", async () => {
    expect(await SignIn({ payload, sso: sso(true, () => ({ google: null })) })).toBeNull()
  })

  it("renders a button for each configured provider, pointed at Payload's routes", async () => {
    const element = await SignIn({
      payload,
      sso: sso(true, () => ({ google: credentials, discord: credentials })),
    })

    expect(element?.type).toBe(SignInButtons)
    expect(element?.props).toEqual({
      providers: ["google", "discord"],
      authPath: "/api/auth",
      adminPath: "/admin",
    })
  })
})
