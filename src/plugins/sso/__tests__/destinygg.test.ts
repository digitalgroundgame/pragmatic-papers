import { createHash } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DESTINYGG_URLS,
  destinyggChallenge,
  destinyggPlugin,
  destinyggProvider,
  type DestinyggProfile,
} from "../destinygg"

const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex")

const emailFor = vi.fn<(profile: DestinyggProfile) => Promise<string | null>>()
const provider = destinyggProvider({ clientId: "dgg-id", clientSecret: "dgg-secret", emailFor })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const requestedURL = (call = 0) => new URL(String(fetchMock.mock.calls[call]?.[0]))

describe("destinyggChallenge", () => {
  it("is what Destiny.gg's token endpoint checks: base64 of hex SHA-256, secret hashed", async () => {
    // OAuthController::tokenExchange: base64_encode(hash('sha256', $verifier . $storedSecret)),
    // where the stored secret is hash('sha256', $secret).
    const verifier = "v".repeat(43)
    const expected = Buffer.from(sha256Hex(verifier + sha256Hex("dgg-secret"))).toString("base64")
    expect(await destinyggChallenge(verifier, "dgg-secret")).toBe(expected)
  })
})

describe("destinyggProvider", () => {
  it("sends people to Destiny.gg's authorize page with its own challenge", async () => {
    const url = await provider.createAuthorizationURL({
      state: "state-1",
      codeVerifier: "verifier-".padEnd(43, "x"),
      redirectURI: "https://example.com/api/auth/callback/destinygg",
    })

    expect(`${url.origin}${url.pathname}`).toBe(DESTINYGG_URLS.authorize)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "dgg-id",
      redirect_uri: "https://example.com/api/auth/callback/destinygg",
      state: "state-1",
      code_challenge: await destinyggChallenge("verifier-".padEnd(43, "x"), "dgg-secret"),
    })
  })

  it("exchanges the code with a GET, as Destiny.gg expects", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        scope: "identify",
        token_type: "bearer",
      }),
    )

    const tokens = await provider.validateAuthorizationCode({
      code: "code-1",
      codeVerifier: "verifier",
      redirectURI: "https://example.com/api/auth/callback/destinygg",
    })

    const url = requestedURL()
    expect(`${url.origin}${url.pathname}`).toBe(DESTINYGG_URLS.token)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      grant_type: "authorization_code",
      code: "code-1",
      client_id: "dgg-id",
      redirect_uri: "https://example.com/api/auth/callback/destinygg",
      code_verifier: "verifier",
    })
    expect(tokens).toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      scopes: ["identify"],
      tokenType: "bearer",
    })
    expect(tokens?.accessTokenExpiresAt).toBeInstanceOf(Date)
  })

  it("treats a refused exchange as no tokens, though Destiny.gg answers it with a 200", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "invalid_grant", message: "Invalid code" }))
    expect(
      await provider.validateAuthorizationCode({ code: "c", codeVerifier: "v", redirectURI: "r" }),
    ).toBeNull()
  })

  it("exchanges nothing without a verifier", async () => {
    expect(await provider.validateAuthorizationCode({ code: "c", redirectURI: "r" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reads the profile with ?token= and signs in with the matched user's address", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ nick: "Someone", username: "Someone", userId: 42, roles: ["USER"] }),
    )
    emailFor.mockResolvedValue("someone@example.com")

    const result = await provider.getUserInfo({ accessToken: "access" })

    const url = requestedURL()
    expect(`${url.origin}${url.pathname}`).toBe(DESTINYGG_URLS.userInfo)
    expect(url.searchParams.get("token")).toBe("access")
    expect(emailFor).toHaveBeenCalledWith({ userId: 42, username: "Someone", nick: "Someone" })
    expect(result?.user).toEqual({
      name: "Someone",
      email: "someone@example.com",
      emailVerified: false,
    })
    expect(
      await provider.accountSubject({ tokens: { accessToken: "access" }, profile: result!.data }),
    ).toBe("42")
  })

  it("gives no address for an account nobody here names", async () => {
    fetchMock.mockResolvedValue(Response.json({ username: "Stranger", userId: 7 }))
    emailFor.mockResolvedValue(null)
    expect((await provider.getUserInfo({ accessToken: "access" }))?.user.email).toBeUndefined()
  })

  it("returns nothing for an expired or unknown token", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "token_expired", code: 403 }))
    expect(await provider.getUserInfo({ accessToken: "access" })).toBeNull()
    expect(emailFor).not.toHaveBeenCalled()
  })

  it("never lets a sign-in create a user", () => {
    expect(provider.disableSignUp).toBe(true)
    expect(provider.options?.disableSignUp).toBe(true)
  })
})

describe("destinyggPlugin", () => {
  it("adds Destiny.gg in front of the built-in providers", async () => {
    const google = { id: "google" }
    const plugin = destinyggPlugin({ clientId: "id", clientSecret: "secret", emailFor })
    const result = (await plugin.init!({ socialProviders: [google] } as never)) as {
      context: { socialProviders: { id: string }[] }
    }
    expect(result.context.socialProviders.map(({ id }) => id)).toEqual(["destinygg", "google"])
  })
})
