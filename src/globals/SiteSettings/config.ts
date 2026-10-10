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
          name: "ticker",
          label: "Ticker",
          defaultValue: false,
          admin: {
            description:
              "The strip under the header on every page: a broadcast when one of our YouTube channels is live, and our latest posts from Bluesky and X.",
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
