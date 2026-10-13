import { createHash } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DESTINY_URLS,
  destinyChallenge,
  destinyPlugin,
  destinyProvider,
  readProfile,
  type DestinyProfile,
} from "../destiny"

const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex")

const emailFor = vi.fn<(profile: DestinyProfile) => Promise<string | null>>()
const provider = destinyProvider({ clientId: "dgg-id", clientSecret: "dgg-secret", emailFor })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const requestedURL = (call = 0) => new URL(String(fetchMock.mock.calls[call]?.[0]))

describe("destinyChallenge", () => {
  it("is what Destiny.gg's token endpoint checks: base64 of hex SHA-256, secret hashed", async () => {
    // OAuthController::tokenExchange: base64_encode(hash('sha256', $verifier . $storedSecret)),
    // where the stored secret is hash('sha256', $secret).
    const verifier = "v".repeat(43)
    const expected = Buffer.from(sha256Hex(verifier + sha256Hex("dgg-secret"))).toString("base64")
    expect(await destinyChallenge(verifier, "dgg-secret")).toBe(expected)
  })
})

describe("destinyProvider", () => {
  it("sends people to Destiny.gg's authorize page with its own challenge", async () => {
    const url = await provider.createAuthorizationURL({
      state: "state-1",
      codeVerifier: "verifier-".padEnd(43, "x"),
      redirectURI: "https://example.com/api/auth/callback/destiny",
    })

    expect(`${url.origin}${url.pathname}`).toBe(DESTINY_URLS.authorize)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "dgg-id",
      redirect_uri: "https://example.com/api/auth/callback/destiny",
      state: "state-1",
      code_challenge: await destinyChallenge("verifier-".padEnd(43, "x"), "dgg-secret"),
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
      redirectURI: "https://example.com/api/auth/callback/destiny",
    })

    const url = requestedURL()
    expect(`${url.origin}${url.pathname}`).toBe(DESTINY_URLS.token)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      grant_type: "authorization_code",
      code: "code-1",
      client_id: "dgg-id",
      redirect_uri: "https://example.com/api/auth/callback/destiny",
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

  it("treats an error response from the token endpoint as no tokens", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 502 }))
    expect(
      await provider.validateAuthorizationCode({ code: "c", codeVerifier: "v", redirectURI: "r" }),
    ).toBeNull()
  })

  it("accepts a bare access token, with no expiry, refresh token or scope", async () => {
    fetchMock.mockResolvedValue(Response.json({ access_token: "access" }))
    expect(
      await provider.validateAuthorizationCode({ code: "c", codeVerifier: "v", redirectURI: "r" }),
    ).toEqual({
      accessToken: "access",
      refreshToken: undefined,
      accessTokenExpiresAt: undefined,
      scopes: [],
      tokenType: undefined,
    })
  })

  it("reads no profile without an access token, or when the profile request fails", async () => {
    expect(await provider.getUserInfo({})).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValue(new Response("down", { status: 500 }))
    expect(await provider.getUserInfo({ accessToken: "access" })).toBeNull()
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
    expect(`${url.origin}${url.pathname}`).toBe(DESTINY_URLS.userInfo)
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

describe("destinyPlugin", () => {
  it("adds Destiny.gg in front of the built-in providers", async () => {
    const google = { id: "google" }
    const plugin = destinyPlugin({ clientId: "id", clientSecret: "secret", emailFor })
    const result = (await plugin.init!({ socialProviders: [google] } as never)) as {
      context: { socialProviders: { id: string }[] }
    }
    expect(result.context.socialProviders.map(({ id }) => id)).toEqual(["destiny", "google"])
  })
})

describe("readProfile", () => {
  it("reads the archived source's fields", () => {
    expect(
      readProfile({ userId: 42, username: "Someone", nick: "Someone2", roles: ["USER"] }),
    ).toEqual({
      userId: 42,
      username: "Someone",
      nick: "Someone2",
    })
  })

  it("reads the usual OAuth spellings too, in case the live API differs", () => {
    expect(readProfile({ sub: "42", preferred_username: "Someone" })).toEqual({
      userId: "42",
      username: "Someone",
      nick: undefined,
    })
    expect(readProfile({ id: 42, nick: "Someone" })).toEqual({
      userId: 42,
      username: "Someone",
      nick: "Someone",
    })
  })

  it("ignores any email address it's sent", () => {
    expect(
      readProfile({ userId: 42, username: "Someone", email: "a@example.com" }),
    ).not.toHaveProperty("email")
  })

  it("returns nothing for an error, or without an id or a name", () => {
    expect(readProfile({ error: "token_expired" })).toBeNull()
    expect(readProfile({ username: "Someone" })).toBeNull()
    expect(readProfile({ userId: 42 })).toBeNull()
    expect(readProfile({ userId: "", username: "Someone" })).toBeNull()
    expect(readProfile(null)).toBeNull()
    expect(readProfile("nope")).toBeNull()
  })
})
