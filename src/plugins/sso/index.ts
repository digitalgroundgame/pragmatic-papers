import type { CollectionConfig } from "payload"

import { isPluginOn, registerPlugin } from "@/utilities/registerPlugin"

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
export const ssoPlugin = registerPlugin<SsoPluginConfig>({
  slug: "sso",
  manifest: {
    name: "SSO",
    source: "src/plugins/sso",
    description:
      "Staff sign-in to the admin with Google or Discord, through Better Auth. Email and password login stays on.",
    switch: {
      label: "Single sign-on",
      description:
        "“Sign in with Google” and “Sign in with Discord” on the admin's login page, for people who already have an account here. Each provider also needs its credentials (System → Integrations).",
      defaultValue: false,
    },
  },
  plugin: ({ config, plugins: _plugins, ...options }) => {
    const sso: ResolvedSsoConfig = {
      usersSlug: "users",
      cookieName: DEFAULT_COOKIE_NAME,
      sessionSeconds: 60 * 60 * 24 * 7,
      requiredUserColumns: [],
      ...options,
      enabled: ({ payload }) => isPluginOn(options.enabled, payload),
    }

    const collections = (config.collections ?? []).map((collection): CollectionConfig => {
      if (collection.slug !== sso.usersSlug) return collection
      const auth = typeof collection.auth === "object" ? collection.auth : {}
      return {
        ...collection,
        fields: [
          ...collection.fields,
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
  },
})
