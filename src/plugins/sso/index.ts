import type { CollectionConfig, Plugin } from "payload"

import { DEFAULT_COOKIE_NAME } from "./constants"
import { authEndpoints } from "./endpoints/auth"
import { endSsoSession } from "./hooks/endSsoSession"
import { ssoStrategy } from "./strategy"
import type { ResolvedSsoConfig, SsoPluginConfig } from "./types"

export { DEFAULT_COOKIE_NAME as SSO_COOKIE_NAME } from "./constants"
export { ssoAfterSchemaInit } from "./schema"
export type { SsoPluginConfig, SsoProviderCredentials, SsoProviderId } from "./types"

/**
 * Sign in to Payload with Google or Discord, through Better Auth.
 *
 * Better Auth runs the OAuth exchange and keeps its own sessions and linked accounts in
 * three tables (`ssoAfterSchemaInit`, which goes in the database adapter's
 * `afterSchemaInit`). Payload keeps everything else: its users, their roles, and its own
 * email and password login, which stays as the way in when a provider is down. A provider
 * login never creates a user; it attaches to the one whose address it has verified.
 */
export function ssoPlugin(options: SsoPluginConfig): Plugin {
  const sso: ResolvedSsoConfig = {
    enabled: () => true,
    usersSlug: "users",
    cookieName: DEFAULT_COOKIE_NAME,
    sessionSeconds: 60 * 60 * 24 * 7,
    requiredUserColumns: [],
    ...options,
  }

  return (config) => {
    const collections = (config.collections ?? []).map((collection): CollectionConfig => {
      if (collection.slug !== sso.usersSlug) return collection
      const auth = typeof collection.auth === "object" ? collection.auth : {}
      return {
        ...collection,
        fields: [
          ...collection.fields,
          {
            // Better Auth's record that a provider vouched for this address. Nothing in
            // Payload sets or reads it.
            name: "emailVerified",
            type: "checkbox",
            defaultValue: false,
            access: { create: () => false, update: () => false },
            admin: { hidden: true },
          },
          {
            // Better Auth's `image`. Its user model reads the column, but only a user it
            // created would have one written, and it creates none.
            name: "avatarUrl",
            type: "text",
            access: { create: () => false, update: () => false },
            admin: { hidden: true },
          },
        ],
        ...(!options.disabled && {
          auth: { ...auth, strategies: [...(auth.strategies ?? []), ssoStrategy(sso)] },
          hooks: {
            ...collection.hooks,
            afterLogout: [...(collection.hooks?.afterLogout ?? []), endSsoSession(sso)],
          },
        }),
      }
    })

    if (options.disabled) return { ...config, collections }

    return {
      ...config,
      collections,
      endpoints: [...(config.endpoints ?? []), ...authEndpoints(sso)],
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
