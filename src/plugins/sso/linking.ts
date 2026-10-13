import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { generateIdTokenNonce, generateState, getOAuthCallbackPath } from "better-auth/oauth2"

/** What `linkForUser` needs: the provider, and the Payload user the account attaches to. */
export interface LinkForUserBody {
  provider: string
  userId: string
  email: string
  /** Where the provider's callback lands, linked or not. */
  callbackURL: string
  errorCallbackURL: string
}

/**
 * Starts linking a provider account to a user who is signed in to Payload. Better Auth's own
 * `/link-social` wants a Better Auth session, and someone signed in with their password has
 * only Payload's, so the Payload endpoint (`endpoints/links.ts`) checks `req.user` and calls
 * this. It's server-only: there's no route to it over HTTP.
 *
 * The callback is Better Auth's usual one, which attaches the account to the user named in
 * the OAuth state and creates no session.
 */
export function linkingPlugin(): BetterAuthPlugin {
  return {
    id: "payload-linking",
    endpoints: {
      linkForUser: createAuthEndpoint.serverOnly({ method: "POST" }, async (c) => {
        const { provider: providerId, userId, email } = c.body as LinkForUserBody
        const provider = c.context.socialProviders.find(({ id }) => id === providerId)
        if (!provider) throw new APIError("NOT_FOUND", { message: "Provider not found" })

        const idTokenNonce = generateIdTokenNonce(provider)
        const { state, codeVerifier } = await generateState(c, {
          link: { userId, email },
          idTokenNonce,
        })
        const url = await provider.createAuthorizationURL({
          state,
          codeVerifier,
          idTokenNonce,
          redirectURI: `${c.context.baseURL}${getOAuthCallbackPath(provider)}`,
        })
        return c.json({ url: url.toString() })
      }),
    },
  }
}
