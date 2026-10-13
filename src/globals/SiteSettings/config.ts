import type { CheckboxField, GlobalConfig } from "payload"
import { isAdmin } from "@/access/roles"
import { revalidateSiteSettings } from "./hooks/revalidateSiteSettings"

/** An experiment's checkbox, shown as an on/off switch in the admin. */
function experimentField(field: Omit<CheckboxField, "type">): CheckboxField {
  return {
    ...field,
    type: "checkbox",
    admin: {
      ...field.admin,
      components: {
        Field: "@/globals/SiteSettings/components/ExperimentSwitchField#ExperimentSwitchField",
      },
    },
  }
}

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Settings",
  access: {
    read: () => true,
    update: ({ req: { user } }) => isAdmin(user),
  },
  admin: {
    group: "System",
    hidden: ({ user }) => !isAdmin(user),
  },
  fields: [
    {
      name: "experiments",
      type: "group",
      admin: {
        description:
          "Beta features, switched on per environment: staging and production each keep their own settings. Off means readers can't reach the feature here.",
      },
      fields: [
        experimentField({
          name: "feed",
          label: "Vertical article feed",
          defaultValue: false,
          admin: { description: "The full-screen article feed at /feed and its header button." },
        }),
        experimentField({
          name: "interactives",
          label: "Interactive pages",
          defaultValue: false,
          admin: {
            description:
              "Interactive pages at /interactives/<slug>, their sitemap and the daily data sync.",
          },
        }),
        experimentField({
          name: "docs",
          label: "Help docs",
          defaultValue: false,
          admin: {
            description:
              "The help docs at /docs, their sitemap, and their items in the notifications bell. Staff can write docs in the admin either way.",
          },
        }),
        experimentField({
          name: "notifications",
          label: "Notifications bell",
          defaultValue: false,
          admin: { description: "The bell beside the avatar in the admin header." },
        }),
        experimentField({
          name: "tours",
          label: "Guided tours",
          defaultValue: false,
          admin: {
            description:
              "Guided tours of the admin, and the Show me buttons that start them in the bell and on help docs.",
          },
        }),
        experimentField({
          name: "sso",
          label: "Single sign-on",
          defaultValue: false,
          admin: {
            description:
              "“Sign in with Google” and “Sign in with Discord” on the admin's login page, for people who already have an account here. Each provider also needs its credentials (System → Integrations).",
          },
        }),
        experimentField({
          name: "comments",
          label: "Comments",
          defaultValue: false,
          admin: {
            description:
              "Comments under articles, from readers who sign in with Google or Discord, and their moderation under Content. The providers need their credentials (System → Integrations).",
          },
        }),
        experimentField({
          name: "tableOfContents",
          label: "Article table of contents",
          // On by default, unlike the other experiments: readers get it unless
          // an environment switches it off.
          defaultValue: true,
          admin: {
            description:
              "The table of contents in an article's sidebar and its hero button, on articles with “Show table of contents” ticked.",
          },
        }),
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateSiteSettings],
  },
}
