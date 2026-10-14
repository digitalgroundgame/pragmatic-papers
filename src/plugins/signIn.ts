import { randomBytes } from "node:crypto"

import { isStaff } from "@/access/roles"
import { destinySignIn, discordSignIn, googleSignIn } from "@/integrations"
import type { User } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"
import type { Payload } from "payload"

import { SSO_PROVIDER_LABELS, type SsoPluginConfig, type SsoProviderId } from "./sso"

/**
 * A plugin's switch on System → Plugins, read from the database on each request rather than
 * through `isPluginEnabled`'s cache, so turning it off takes effect at once.
 */
const switchOn = async (payload: Payload, name: "sso" | "comments"): Promise<boolean> =>
  (await payload.findGlobal({ slug: "plugins", depth: 0 })).switches?.[name] === true

/**
 * Whether comments are on: their switch, and single sign-on's, since readers have no other way
 * to sign in. With SSO off, the comment box would offer buttons that lead nowhere.
 */
export const commentsOn = async (payload: Payload): Promise<boolean> => {
  const { switches } = await payload.findGlobal({ slug: "plugins", depth: 0 })
  return switches?.comments === true && switches.sso === true
}

/**
 * The sign-in plugin's options. The comments plugin and the account page read who is signed
 * in with them too (`getSignedInUser`), so they live here rather than inline in `plugins`.
 */
export const ssoOptions: SsoPluginConfig = {
  // Turning it off ends SSO sessions at once.
  enabled: (payload) => switchOn(payload, "sso"),
  providers: () => ({
    google: googleSignIn.credentials(),
    discord: discordSignIn.credentials(),
    destiny: destinySignIn.credentials(),
  }),
  baseURL: getSiteURL,
  secret: () => process.env.PAYLOAD_SECRET || "",
  // Only staff become Payload's logged-in user. Members are signed in to the site (comments,
  // their account page) but anonymous to the admin and to every access rule.
  isPayloadUser: (user) => isStaff(user as unknown as User),
  // Readers make an account by signing in to comment, so sign-ups open with comments. Each
  // is a member and nothing more; an admin gives anyone a staff role.
  signUp: {
    enabled: ({ payload }) => commentsOn(payload),
    // Members have no public page; the slug only has to be unique.
    columns: () => ({ slug: `member-${randomBytes(6).toString("hex")}` }),
    afterCreate: async ({ payload, userId }) => {
      await payload.update({
        collection: "users",
        id: Number(userId),
        // The slug stays the random one: regenerated from a name a member chose, it could
        // collide with a staff member's.
        data: { roles: ["member"], generateSlug: false },
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
    },
  },
  // The Users collection's slug field (`src/fields/slug`), set by Payload on create.
  requiredUserColumns: ["slug"],
  // A provider sign-in lasts a month.
  sessionSeconds: 60 * 60 * 24 * 30,
}

/**
 * The providers someone can make an account with: those with credentials. Destiny.gg shares
 * no address, so its sign-ups get a placeholder until they link Google or Discord.
 */
export function signUpProviders(): Array<{ id: SsoProviderId; label: string }> {
  const credentials = {
    google: googleSignIn.credentials(),
    discord: discordSignIn.credentials(),
    destiny: destinySignIn.credentials(),
  }
  return (["google", "discord", "destiny"] as const)
    .filter((id) => credentials[id])
    .map((id) => ({ id, label: SSO_PROVIDER_LABELS[id] }))
}
