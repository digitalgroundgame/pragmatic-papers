import type { OAuth2Tokens } from "better-auth/oauth2"
import type { GenericOAuthConfig, GenericOAuthUserInfo } from "better-auth/plugins/generic-oauth"

import { placeholderEmail } from "./placeholderEmail"
import type { SsoProviderCredentials } from "./types"

/** The provider's id, in `/api/auth/callback/digitalgroundgame`. */
export const DGG_PROVIDER_ID = "digitalgroundgame"

/** Digital Ground Game's Authentik, when `AUTHENTIK_URL` doesn't name another. */
export const DEFAULT_AUTHENTIK_URL = "https://auth.digitalgroundgame.org"

/** How long a sign-in waits on Authentik's userinfo endpoint before giving up. */
export const AUTHENTIK_TIMEOUT_MS = 10_000

/**
 * Authentik's OAuth endpoints, which are the same for every application on an instance
 * (only the issuer and discovery document are per application).
 */
export function authentikEndpoints(baseUrl: string): {
  authorize: string
  token: string
  userInfo: string
} {
  const base = baseUrl.replace(/\/+$/, "")
  return {
    authorize: `${base}/application/o/authorize/`,
    token: `${base}/application/o/token/`,
    userInfo: `${base}/application/o/userinfo/`,
  }
}

/** The userinfo claims we read, from Authentik's `openid`, `email` and `profile` scopes. */
export interface AuthentikProfile {
  sub: string
  email?: string
  emailVerified: boolean
  name?: string
  picture?: string
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined

/**
 * The profile from Authentik's userinfo, or null when it has no subject. The name falls back
 * to the username (`preferred_username`), since a DGG account's display name is optional.
 */
export function readAuthentikProfile(body: unknown): AuthentikProfile | null {
  if (typeof body !== "object" || body === null) return null
  const claims = body as Record<string, unknown>
  const sub = text(claims.sub)
  if (!sub) return null
  return {
    sub,
    email: text(claims.email)?.toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: text(claims.name) ?? text(claims.preferred_username) ?? text(claims.nickname),
    picture: text(claims.picture),
  }
}

/** Reads the signed-in DGG account from Authentik, or null when it fails or times out. */
async function fetchProfile(url: string, tokens: OAuth2Tokens): Promise<AuthentikProfile | null> {
  if (!tokens.accessToken) return null
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      signal: AbortSignal.timeout(AUTHENTIK_TIMEOUT_MS),
    })
    return response.ok ? readAuthentikProfile(await response.json()) : null
  } catch {
    return null
  }
}

export interface DigitalGroundGameOptions extends SsoProviderCredentials {
  /** The Authentik instance's origin. Default `DEFAULT_AUTHENTIK_URL`. */
  baseUrl?: string
  /** Whether a DGG sign-in may make an account, when it asks for one (`requestSignUp`). */
  signUp?: boolean
  /** Whether some user here already has this address. */
  emailTaken: (email: string) => Promise<boolean>
}

/**
 * The user Better Auth signs in or creates for a DGG account.
 *
 * A DGG account that's linked signs in as its user whatever its address says: Better Auth
 * finds it by its subject first. Otherwise its address decides, and it may only ever make a
 * new member:
 *
 * - An address nobody here has is passed on, verified if Authentik says so (its default
 *   mapping says it isn't), so a sign-up can make a member with it.
 * - An address someone here has is swapped for a placeholder nobody has. Better Auth would
 *   otherwise sign in as that user on the spot, on Authentik's word that the address is theirs;
 *   instead they connect DGG from their account page, the way Destiny.gg is linked. The
 *   placeholder is unverified, so it can't make an account either.
 */
export async function authentikUser(
  profile: AuthentikProfile,
  emailTaken: (email: string) => Promise<boolean>,
): Promise<{ name?: string; email: string; emailVerified: boolean; image?: string }> {
  const usable = profile.email && !(await emailTaken(profile.email)) ? profile.email : null
  return {
    name: profile.name,
    email: usable ?? placeholderEmail(DGG_PROVIDER_ID, profile.sub),
    emailVerified: usable !== null && profile.emailVerified,
    image: profile.picture,
  }
}

/**
 * "Sign in with Digital Ground Game": an OAuth2/OIDC application on DGG's Authentik, served
 * by Better Auth's generic OAuth plugin as one more social provider, so `/sign-in/social`,
 * `/callback/digitalgroundgame` and linking from the account page work as they do for the
 * others.
 *
 * The endpoints are fixed rather than discovered: discovery would put a request to Authentik
 * in front of every provider's first sign-in after a restart, and hang them all if Authentik
 * did. The profile is read from userinfo with the access token, over TLS, straight from
 * Authentik, and its subject is the account's key.
 */
export function digitalGroundGameConfig(options: DigitalGroundGameOptions): GenericOAuthConfig {
  const { clientId, clientSecret, signUp = false, emailTaken } = options
  const endpoints = authentikEndpoints(options.baseUrl ?? DEFAULT_AUTHENTIK_URL)

  return {
    providerId: DGG_PROVIDER_ID,
    name: "Digital Ground Game",
    clientId,
    clientSecret,
    authorizationUrl: endpoints.authorize,
    tokenUrl: endpoints.token,
    scopes: ["openid", "email", "profile"],
    pkce: true,
    // Same rules as the built-in providers (`auth.ts`).
    disableSignUp: !signUp,
    disableImplicitSignUp: signUp,
    getUserInfo: async (tokens) => {
      const profile = await fetchProfile(endpoints.userInfo, tokens)
      if (!profile) return null
      return { ...profile, id: profile.sub } satisfies GenericOAuthUserInfo
    },
    accountSubject: ({ profile }) => String(profile.sub ?? ""),
    mapProfileToUser: (profile) =>
      authentikUser(profile as unknown as AuthentikProfile, emailTaken),
  }
}
