import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { describe, expect, it } from "vitest"

import { linkingPlugin, type LinkForUserBody } from "../linking"

function auth() {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] }
  return betterAuth({
    baseURL: "https://example.com",
    basePath: "/api/auth",
    secret: "a-secret-long-enough-for-better-auth-to-accept",
    database: memoryAdapter(db),
    socialProviders: { discord: { clientId: "discord-id", clientSecret: "discord-secret" } },
    plugins: [linkingPlugin()],
    telemetry: { enabled: false },
  })
}

type LinkForUser = (args: {
  body: LinkForUserBody
  headers?: Headers
  asResponse?: boolean
}) => Promise<{ url: string }>

const linkForUser = (instance: ReturnType<typeof auth>) =>
  (instance.api as unknown as { linkForUser: LinkForUser }).linkForUser

const body: LinkForUserBody = {
  provider: "discord",
  userId: "7",
  email: "someone@example.com",
  callbackURL: "/admin/account?linked=discord",
  errorCallbackURL: "/admin/account",
}

describe("linkingPlugin", () => {
  it("returns the provider's authorize URL, calling back to Better Auth's own callback", async () => {
    const { url } = await linkForUser(auth())({ body, headers: new Headers() })
    const authorize = new URL(url)

    expect(authorize.origin).toBe("https://discord.com")
    expect(authorize.searchParams.get("client_id")).toBe("discord-id")
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/auth/callback/discord",
    )
    expect(authorize.searchParams.get("state")).toBeTruthy()
  })

  it("sets the OAuth state cookie the callback checks", async () => {
    const response = (await linkForUser(auth())({
      body,
      headers: new Headers(),
      asResponse: true,
    })) as unknown as Response

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain("state")
  })

  it("refuses a provider that isn't configured", async () => {
    await expect(
      linkForUser(auth())({ body: { ...body, provider: "google" }, headers: new Headers() }),
    ).rejects.toMatchObject({ status: "NOT_FOUND" })
  })

  it("has no HTTP route", async () => {
    const response = await auth().handler(
      new Request("https://example.com/api/auth/link-for-user", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.com" },
        body: JSON.stringify(body),
      }),
    )
    expect(response.status).toBe(404)
  })
})
