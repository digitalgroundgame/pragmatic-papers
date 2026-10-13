import type { CollectionConfig, Condition, Field, Plugin, TabsField } from "payload"

import { DEFAULT_COOKIE_NAME } from "./constants"
import { authEndpoints } from "./endpoints/auth"
import { linkEndpoints } from "./endpoints/links"
import { endSsoSession } from "./hooks/endSsoSession"
import { ssoStrategy } from "./strategy"
import type { ResolvedSsoConfig, SsoPluginConfig } from "./types"

export { DEFAULT_COOKIE_NAME as SSO_COOKIE_NAME } from "./constants"
export { ssoAfterSchemaInit } from "./schema"
export type { SsoPluginConfig, SsoProviderCredentials, SsoProviderId } from "./types"

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

/** The Connections panel: the signed-in user's linked sign-in accounts. */
const connectionsField: Field = {
  name: "linkedAccounts",
  type: "ui",
  admin: { components: { Field: "@/plugins/sso/exports/client#LinkedAccounts" } },
}

/** Only the signed-in user's own record has connections to show. */
const isOwnRecord: Condition = (data, _siblingData, { user }) =>
  user != null && data.id != null && String(user.id) === String(data.id)

/**
 * Adds the Connections panel to the users collection: as a tab of its first tabs field,
 * shown on the user's own record only, or below its fields when it has no tabs.
 */
function withConnections(fields: Field[]): Field[] {
  const index = fields.findIndex((field) => field.type === "tabs")
  if (index === -1) return [...fields, connectionsField]
  return fields.map((field, i): Field => {
    if (i !== index) return field
    const { tabs } = field as TabsField
    return {
      ...(field as TabsField),
      tabs: [
        ...tabs,
        { label: "Connections", admin: { condition: isOwnRecord }, fields: [connectionsField] },
      ],
    }
  })
}

/**
 * Sign in to Payload with Google, Discord or Destiny.gg, through Better Auth.
 *
 * Better Auth runs the OAuth exchange and keeps its own sessions and linked accounts in
 * three tables (`ssoAfterSchemaInit`, which goes in the database adapter's
 * `afterSchemaInit`). Payload keeps everything else: its users, their roles, and its own
 * email and password login, which stays as the way in when a provider is down. A provider
 * login never creates a user; it attaches to the one whose address it has verified, or to
 * the one who linked it from their account page (the only way for Destiny.gg, which shares
 * no address).
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
        fields: [...collection.fields, ...betterAuthFields],
        ...(!options.disabled && {
          fields: withConnections([...collection.fields, ...betterAuthFields]),
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
      endpoints: [...(config.endpoints ?? []), ...authEndpoints(sso), ...linkEndpoints(sso)],
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
