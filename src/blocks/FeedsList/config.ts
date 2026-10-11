import type { Block } from "payload"

export const FeedsList: Block = {
  slug: "feedsList",
  dbName: "feeds_list",
  interfaceName: "FeedsListBlock",
  labels: { plural: "Feed lists", singular: "Feed list" },
  admin: {
    // The links come from code, so a new feed or sitemap shows up without anyone editing this.
    disableBlockName: true,
  },
  fields: [
    {
      name: "list",
      type: "select",
      required: true,
      defaultValue: "feeds",
      options: [
        { label: "RSS feeds", value: "feeds" },
        { label: "Sitemaps", value: "sitemaps" },
      ],
      admin: {
        description:
          "Which links to show. They're kept up to date by the site itself: you only write the heading and introduction.",
      },
    },
    { name: "title", type: "text" },
    { name: "description", type: "textarea", label: "Introduction" },
  ],
}
