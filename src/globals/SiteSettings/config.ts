import type { GlobalConfig } from "payload"
import { isAdmin } from "@/access/roles"
import { revalidateSiteSettings } from "./hooks/revalidateSiteSettings"

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
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
        {
          name: "feed",
          label: "Vertical article feed",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "The full-screen article feed at /feed and its header button." },
        },
        {
          name: "interactives",
          label: "Interactive pages",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description:
              "Interactive pages at /interactives/<slug>, their sitemap and the daily data sync.",
          },
        },
        {
          name: "ticker",
          label: "Home page ticker",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description:
              "The strip under the header on the home page: the podcast when it's live on YouTube, and our latest posts from Bluesky and X.",
          },
        },
        {
          name: "tableOfContents",
          label: "Article table of contents",
          type: "checkbox",
          // On by default, unlike the other experiments: readers get it unless
          // an environment switches it off.
          defaultValue: true,
          admin: {
            description:
              "The table of contents in an article's sidebar and its hero button, on articles with “Show table of contents” ticked.",
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateSiteSettings],
  },
}
