import type { BetterAuthPlugin } from "better-auth"
import type { OAuth2Tokens, OAuthProvider } from "better-auth/oauth2"

import type { SsoProviderCredentials } from "./types"

/** Destiny.gg's OAuth endpoints (its `OAUTH.md`, in destiny/website). */
export const DESTINY_URLS = {
  authorize: "https://www.destiny.gg/oauth/authorize",
  token: "https://www.destiny.gg/oauth/token",
  userInfo: "https://www.destiny.gg/api/userinfo",
} as const

/** What `/api/userinfo` returns. It has no email address. */
export interface DestinyProfile {
  userId: number | string
  username: string
  nick?: string
}

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")

const sha256Hex = async (text: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))

/**
 * Destiny.gg's own PKCE challenge, not RFC 7636's: the base64 of the hex SHA-256 of the
 * verifier followed by the hex SHA-256 of the client secret. Its token endpoint checks the
 * verifier against this, so Better Auth's standard S256 challenge is refused.
 */
export async function destinyChallenge(verifier: string, clientSecret: string): Promise<string> {
  return btoa(await sha256Hex(verifier + (await sha256Hex(clientSecret))))
}

export interface DestinyProviderOptions extends SsoProviderCredentials {
  /**
   * The email address of the user a Destiny.gg account signs in as, or null for nobody.
   * Destiny.gg never shares an address, so this is how Better Auth finds the user.
   */
  emailFor: (profile: DestinyProfile) => Promise<string | null>
  /**
   * Whether a Destiny.gg sign-in may make an account, when it asks for one
   * (`requestSignUp`). Off, it only ever finds a user who exists.
   */
  signUp?: boolean
}

/**
 * Destiny.gg as a Better Auth sign-in provider. It's plain OAuth with three quirks Better
 * Auth's generic OAuth can't be told about: the challenge above, a token exchange sent as a
 * GET with query parameters, and a profile that's read with `?token=` and has no address.
 */
export function destinyProvider(options: DestinyProviderOptions): OAuthProvider<DestinyProfile> {
  const { clientId, clientSecret, emailFor, signUp = false } = options

  return {
    id: "destiny",
    name: "Destiny.gg",
    accountSubject: ({ profile }) => String(profile.userId),
    disableSignUp: !signUp,
    disableImplicitSignUp: signUp,
    options: { clientId, clientSecret, disableSignUp: !signUp },

    async createAuthorizationURL({ state, codeVerifier, redirectURI }) {
      const url = new URL(DESTINY_URLS.authorize)
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectURI,
        state,
        code_challenge: await destinyChallenge(codeVerifier, clientSecret),
      }).toString()
      return url
    },

    async validateAuthorizationCode({ code, redirectURI, codeVerifier }) {
      if (!codeVerifier) return null
      const url = new URL(DESTINY_URLS.token)
      url.search = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectURI,
        code_verifier: codeVerifier,
      }).toString()
      const response = await fetch(url)
      if (!response.ok) return null
      // A refused exchange is still a 200, with `error` in the body.
      const body = (await response.json()) as {
        access_token?: string
        refresh_token?: string
        expires_in?: number
        scope?: string
        token_type?: string
      }
      if (!body.access_token) return null
      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        accessTokenExpiresAt: body.expires_in
          ? new Date(Date.now() + body.expires_in * 1000)
          : undefined,
        scopes: body.scope ? body.scope.split(" ") : [],
        tokenType: body.token_type,
      } satisfies OAuth2Tokens
    },

    async getUserInfo({ accessToken }) {
      if (!accessToken) return null
      const url = new URL(DESTINY_URLS.userInfo)
      url.searchParams.set("token", accessToken)
      const response = await fetch(url)
      if (!response.ok) return null
      const profile = (await response.json()) as Partial<DestinyProfile> & { error?: string }
      if (profile.error || !profile.userId || !profile.username) return null

      const data: DestinyProfile = {
        userId: profile.userId,
        username: profile.username,
        nick: profile.nick,
      }
      return {
        user: {
          name: data.username,
          // No address means nobody: the callback sends them back with `email_not_found`.
          email: (await emailFor(data)) ?? undefined,
          // The address is ours (a linked user's, or a placeholder), not one Destiny.gg
          // vouched for, so it's never marked verified; the provider is trusted for linking
          // instead (`auth.ts`).
          emailVerified: false,
        },
        data,
      }
    },
  }
}

/**
 * Registers Destiny.gg beside the built-in providers, so `/sign-in/social` and
 * `/callback/destiny` serve it like any other.
 */
export function destinyPlugin(options: DestinyProviderOptions): BetterAuthPlugin {
  return {
    id: "destiny",
    init: (ctx) => ({
      context: { socialProviders: [destinyProvider(options), ...ctx.socialProviders] },
    }),
  }
}
