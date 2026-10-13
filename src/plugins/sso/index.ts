import type { CollectionConfig, Field, Plugin } from "payload"

import { accountEndpoints } from "./endpoints/account"
import { authEndpoints } from "./endpoints/auth"
import { linkEndpoints } from "./endpoints/links"
import { endSsoSession } from "./hooks/endSsoSession"
import { onlyPayloadUsers } from "./hooks/onlyPayloadUsers"
import { resolveSsoConfig } from "./session"
import { ssoStrategy } from "./strategy"
import type { SsoPluginConfig } from "./types"

export {
  DEFAULT_COOKIE_NAME as SSO_COOKIE_NAME,
  DEFAULT_PAYLOAD_USER_COOKIE as SSO_PAYLOAD_USER_COOKIE,
  PROVIDER_LABELS as SSO_PROVIDER_LABELS,
} from "./constants"
export { ssoAfterSchemaInit } from "./schema"
export { getSignedInUser, type SignedInUser } from "./session"
export { MAX_NAME_LENGTH, type AccountSummary } from "./endpoints/account"
export type {
  SsoPluginConfig,
  SsoProviderCredentials,
  SsoProviderId,
  SsoSignUpConfig,
} from "./types"

/** Columns Better Auth reads on the users table. */
const betterAuthFields: Field[] = [
  {
    // Better Auth's record that a provider vouched for this address. Nothing in
    // Payload sets or reads it, and the API never returns it: public authors' records
    // are readable, and it would show who signs in with a provider.
    name: "emailVerified",
    type: "checkbox",
    defaultValue: false,
    access: { create: () => false, read: () => false, update: () => false },
    admin: { hidden: true },
  },
  {
    // Better Auth's `image`. Its user model reads the column, but only a user it
    // created would have one written, and it creates none.
    name: "avatarUrl",
    type: "text",
    access: { create: () => false, read: () => false, update: () => false },
    admin: { hidden: true },
  },
]

/**
 * Sign in to Payload with Google, Discord or Destiny.gg, through Better Auth.
 *
 * Better Auth runs the OAuth exchange and keeps its own sessions and linked accounts in
 * three tables (`ssoAfterSchemaInit`, which goes in the database adapter's
 * `afterSchemaInit`). Payload keeps everything else: its users, their roles, and its own
 * email and password login, which stays as the way in when a provider is down. A provider
 * login attaches to the user whose address it has verified, or to the one who linked it from
 * their account page (the only way for Destiny.gg, which shares no address). It creates a
 * user only when `signUp` is configured and the sign-in asks for one.
 *
 * Only users `isPayloadUser` accepts become Payload's `req.user`. Everyone else signed in
 * (members) is anonymous to Payload, and the site's own features find them with
 * `getSignedInUser`.
 */
export function ssoPlugin(options: SsoPluginConfig): Plugin {
  const sso = resolveSsoConfig(options)

  return (config) => {
    const collections = (config.collections ?? []).map((collection): CollectionConfig => {
      if (collection.slug !== sso.usersSlug) return collection
      const auth = typeof collection.auth === "object" ? collection.auth : {}
      return {
        ...collection,
        fields: [...collection.fields, ...betterAuthFields],
        ...(!options.disabled && {
          fields: [
            ...collection.fields,
            ...betterAuthFields,
            {
              // The Linked accounts panel, on the signed-in user's own account page.
              name: "linkedAccounts",
              type: "ui",
              admin: { components: { Field: "@/plugins/sso/exports/client#LinkedAccounts" } },
            },
          ],
          auth: { ...auth, strategies: [...(auth.strategies ?? []), ssoStrategy(sso)] },
          hooks: {
            ...collection.hooks,
            beforeLogin: [...(collection.hooks?.beforeLogin ?? []), onlyPayloadUsers(sso)],
            afterLogout: [...(collection.hooks?.afterLogout ?? []), endSsoSession(sso)],
          },
        }),
      }
    })

    if (options.disabled) return { ...config, collections }

    return {
      ...config,
      collections,
      endpoints: [
        ...(config.endpoints ?? []),
        ...authEndpoints(sso),
        ...linkEndpoints(sso),
        ...accountEndpoints(sso),
      ],
      admin: {
        ...config.admin,
        components: {
          ...config.admin?.components,
          beforeLogin: [
            ...(config.admin?.components?.beforeLogin ?? []),
            { path: "@/plugins/sso/exports/rsc#SignIn", serverProps: { sso } },
          ],
        },
      },
    }
  }
}
