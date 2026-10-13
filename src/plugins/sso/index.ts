import type { CollectionConfig, Condition, Field, TabsField } from "payload"

import { registerPlugin } from "@/utilities/registerPlugin"

import { configuredProviders } from "./auth"
import { accountEndpoints } from "./endpoints/account"
import { authEndpoints } from "./endpoints/auth"
import { linkEndpoints } from "./endpoints/links"
import { endSsoSession } from "./hooks/endSsoSession"
import { onlyPayloadUsers } from "./hooks/onlyPayloadUsers"
import { resolveSsoConfig } from "./session"
import { ssoStrategy } from "./strategy"
import type { ResolvedSsoConfig, SsoPluginConfig } from "./types"

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

/** The Connections panel: the signed-in user's linked sign-in accounts. */
const connectionsField: Field = {
  name: "linkedAccounts",
  type: "ui",
  admin: { components: { Field: "@/plugins/sso/exports/client#LinkedAccounts" } },
}

/** Names the virtual field that says whether this user's Connections tab has anything. */
const CONNECTIONS_FLAG = "ssoConnections"

/**
 * True on the signed-in user's own record while single sign-on is on and a provider is
 * configured. A tab's condition can't wait on Settings, so this reads it when the record
 * is loaded and the condition reads this. It's virtual: no column.
 */
function connectionsFlag(sso: ResolvedSsoConfig): Field {
  return {
    name: CONNECTIONS_FLAG,
    type: "checkbox",
    virtual: true,
    access: { create: () => false, update: () => false },
    admin: { hidden: true },
    hooks: {
      afterRead: [
        async ({ data, req }) => {
          const own =
            req.user?.collection === sso.usersSlug &&
            data?.id != null &&
            String(req.user.id) === String(data.id)
          if (!own) return undefined
          return (
            configuredProviders(sso).length > 0 && (await sso.enabled({ payload: req.payload }))
          )
        },
      ],
    },
  }
}

/** The Connections tab shows on the user's own record, while there's something to connect. */
const hasConnections: Condition = (data, _siblingData, { user }) =>
  user != null &&
  data.id != null &&
  String(user.id) === String(data.id) &&
  data[CONNECTIONS_FLAG] === true

/**
 * Adds the Connections panel to the users collection: as a tab of its first tabs field,
 * or below its fields when it has no tabs.
 */
function withConnections(fields: Field[], sso: ResolvedSsoConfig): Field[] {
  const index = fields.findIndex((field) => field.type === "tabs")
  if (index === -1) return [...fields, connectionsField]
  return [
    ...fields.map((field, i): Field => {
      if (i !== index) return field
      const { tabs } = field as TabsField
      return {
        ...(field as TabsField),
        tabs: [
          ...tabs,
          {
            label: "Connections",
            admin: { condition: hasConnections },
            fields: [connectionsField],
          },
        ],
      }
    }),
    connectionsFlag(sso),
  ]
}

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
export const ssoPlugin = registerPlugin<SsoPluginConfig>({
  slug: "sso",
  manifest: {
    name: "SSO",
    source: "src/plugins/sso",
    description:
      "Sign-in with Google, Discord or Destiny.gg, through Better Auth: staff to the admin, with a Connections tab on their account, and members to the site, when sign-ups are open. Email and password login stays on.",
    switch: {
      label: "Single sign-on",
      description:
        "“Sign in with Google”, “Sign in with Discord” and “Sign in with Destiny.gg” on the admin's login page, for people who already have an account here, the Connections tab that links them, and members' sign-ins on the site. Each provider also needs its credentials (System → Integrations).",
      defaultValue: false,
    },
  },
  plugin: ({ config, plugins: _plugins, ...options }) => {
    const sso = resolveSsoConfig(options)

    const collections = (config.collections ?? []).map((collection): CollectionConfig => {
      if (collection.slug !== sso.usersSlug) return collection
      const auth = typeof collection.auth === "object" ? collection.auth : {}
      return {
        ...collection,
        fields: [...collection.fields, ...betterAuthFields],
        ...(!options.disabled && {
          fields: withConnections([...collection.fields, ...betterAuthFields], sso),
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
  },
})
