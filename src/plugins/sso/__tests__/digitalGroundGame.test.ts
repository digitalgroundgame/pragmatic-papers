import type { OAuth2Tokens } from "better-auth/oauth2"
import type { GenericOAuthUserInfo } from "better-auth/plugins/generic-oauth"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  authentikEndpoints,
  authentikUser,
  DGG_PROVIDER_ID,
  digitalGroundGameConfig,
  readAuthentikProfile,
  type AuthentikProfile,
} from "../digitalGroundGame"

const fetchMock = vi.fn<typeof fetch>()
const emailTaken = vi.fn<(email: string) => Promise<boolean>>()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  emailTaken.mockResolvedValue(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const claims = {
  sub: "a1b2c3",
  email: "Volunteer@Example.com",
  email_verified: true,
  name: "Vol Unteer",
  preferred_username: "volunteer",
  nickname: "volunteer",
  groups: ["volunteers"],
  picture: "https://auth.digitalgroundgame.org/media/avatar.png",
}

describe("authentikEndpoints", () => {
  it("are Authentik's instance-wide OAuth endpoints, with or without a trailing slash", () => {
    const expected = {
      authorize: "https://auth.example.org/application/o/authorize/",
      token: "https://auth.example.org/application/o/token/",
      userInfo: "https://auth.example.org/application/o/userinfo/",
    }
    expect(authentikEndpoints("https://auth.example.org")).toEqual(expected)
    expect(authentikEndpoints("https://auth.example.org/")).toEqual(expected)
  })
})

describe("readAuthentikProfile", () => {
  it("reads the subject, a lowercased address, whether it's verified, the name and picture", () => {
    expect(readAuthentikProfile(claims)).toEqual({
      sub: "a1b2c3",
      email: "volunteer@example.com",
      emailVerified: true,
      name: "Vol Unteer",
      picture: "https://auth.digitalgroundgame.org/media/avatar.png",
    })
  })

  it("names someone with no display name by their username", () => {
    expect(readAuthentikProfile({ ...claims, name: "" })?.name).toBe("volunteer")
  })

  it("takes Authentik's default unverified address as unverified", () => {
    expect(readAuthentikProfile({ ...claims, email_verified: false })?.emailVerified).toBe(false)
    expect(readAuthentikProfile({ sub: "x" })).toEqual({
      sub: "x",
      email: undefined,
      emailVerified: false,
      name: undefined,
      picture: undefined,
    })
  })

  it("is null without a subject, or for something that isn't an object", () => {
    expect(readAuthentikProfile({ ...claims, sub: "" })).toBeNull()
    expect(readAuthentikProfile(null)).toBeNull()
    expect(readAuthentikProfile("nope")).toBeNull()
  })
})

describe("authentikUser", () => {
  const profile = readAuthentikProfile(claims) as AuthentikProfile

  it("passes on a verified address nobody here has, so it can make a new member", async () => {
    expect(await authentikUser(profile, emailTaken)).toEqual({
      name: "Vol Unteer",
      email: "volunteer@example.com",
      emailVerified: true,
      image: "https://auth.digitalgroundgame.org/media/avatar.png",
    })
    expect(emailTaken).toHaveBeenCalledWith("volunteer@example.com")
  })

  it("swaps an address someone here has for an unverified placeholder, so it finds nobody", async () => {
    emailTaken.mockResolvedValue(true)
    expect(await authentikUser(profile, emailTaken)).toMatchObject({
      email: "digitalgroundgame-a1b2c3@no-email.invalid",
      emailVerified: false,
    })
  })

  it("never vouches for an address Authentik hasn't verified", async () => {
    const user = await authentikUser({ ...profile, emailVerified: false }, emailTaken)
    expect(user).toMatchObject({ email: "volunteer@example.com", emailVerified: false })
  })

  it("gives an account with no address the placeholder", async () => {
    const user = await authentikUser({ sub: "s1", emailVerified: true }, emailTaken)
    expect(user).toMatchObject({
      email: "digitalgroundgame-s1@no-email.invalid",
      emailVerified: false,
    })
    expect(emailTaken).not.toHaveBeenCalled()
  })
})

describe("digitalGroundGameConfig", () => {
  const config = digitalGroundGameConfig({
    clientId: "pp-client",
    clientSecret: "pp-secret",
    emailTaken,
  })
  const tokens = { accessToken: "access" } as OAuth2Tokens

  it("is DGG's Authentik, with PKCE and the OpenID scopes, at fixed endpoints", () => {
    expect(config).toMatchObject({
      providerId: DGG_PROVIDER_ID,
      name: "Digital Ground Game",
      clientId: "pp-client",
      clientSecret: "pp-secret",
      authorizationUrl: "https://auth.digitalgroundgame.org/application/o/authorize/",
      tokenUrl: "https://auth.digitalgroundgame.org/application/o/token/",
      scopes: ["openid", "email", "profile"],
      pkce: true,
    })
    // No discovery: nothing is fetched until someone signs in with it.
    expect(config.discoveryUrl).toBeUndefined()
  })

  it("points at another Authentik when given one", () => {
    const other = digitalGroundGameConfig({
      clientId: "id",
      clientSecret: "secret",
      baseUrl: "https://sso.example.org",
      emailTaken,
    })
    expect(other.authorizationUrl).toBe("https://sso.example.org/application/o/authorize/")
  })

  it("allows sign-ups only when asked to, as the other providers do", () => {
    expect(config).toMatchObject({ disableSignUp: true, disableImplicitSignUp: false })
    const open = digitalGroundGameConfig({
      clientId: "id",
      clientSecret: "secret",
      signUp: true,
      emailTaken,
    })
    expect(open).toMatchObject({ disableSignUp: false, disableImplicitSignUp: true })
  })

  it("reads the profile from userinfo with the access token, keyed by its subject", async () => {
    fetchMock.mockResolvedValue(Response.json(claims))

    const profile = await config.getUserInfo?.(tokens)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("https://auth.digitalgroundgame.org/application/o/userinfo/")
    expect(init?.headers).toEqual({ Authorization: "Bearer access" })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(profile).toMatchObject({ id: "a1b2c3", sub: "a1b2c3" })
    expect(
      await config.accountSubject?.({ profile: profile as GenericOAuthUserInfo, tokens }),
    ).toBe("a1b2c3")
  })

  it("has no profile when Authentik refuses, can't be reached, or there's no token", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }))
    expect(await config.getUserInfo?.(tokens)).toBeNull()

    fetchMock.mockRejectedValueOnce(new Error("timed out"))
    expect(await config.getUserInfo?.(tokens)).toBeNull()

    expect(await config.getUserInfo?.({} as OAuth2Tokens)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("maps the profile with the address rules above", async () => {
    emailTaken.mockResolvedValue(true)
    const user = await config.mapProfileToUser?.({ ...readAuthentikProfile(claims) } as never)
    expect(user).toMatchObject({
      email: "digitalgroundgame-a1b2c3@no-email.invalid",
      emailVerified: false,
    })
  })
})
