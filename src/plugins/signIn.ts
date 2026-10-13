import { randomBytes } from "node:crypto"

import { isStaff } from "@/access/roles"
import { destinySignIn, discordSignIn, googleSignIn } from "@/integrations"
import type { User } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"
import type { Payload } from "payload"

import { SSO_PROVIDER_LABELS, type SsoPluginConfig } from "./sso"

const experimentOn = async (payload: Payload, name: "sso" | "comments") =>
  (await payload.findGlobal({ slug: "site-settings", depth: 0 })).experiments?.[name] === true

/**
 * The sign-in plugin's options. The comments plugin and the account page read who is signed
 * in with them too (`getSignedInUser`), so they live here rather than inline in `plugins`.
 */
export const ssoOptions: SsoPluginConfig = {
  // The `sso` experiment, read from the database on each request rather than through
  // `isExperimentEnabled`'s cache, so turning it off ends SSO sessions at once.
  enabled: ({ payload }) => experimentOn(payload, "sso"),
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
    enabled: ({ payload }) => experimentOn(payload, "comments"),
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
 * The providers someone can make an account with: those with credentials, apart from
 * Destiny.gg, which shares no address to make one from. A member links it from /account.
 */
export function signUpProviders(): Array<{ id: "google" | "discord"; label: string }> {
  const credentials = { google: googleSignIn.credentials(), discord: discordSignIn.credentials() }
  return (["google", "discord"] as const)
    .filter((id) => credentials[id])
    .map((id) => ({ id, label: SSO_PROVIDER_LABELS[id] }))
}
