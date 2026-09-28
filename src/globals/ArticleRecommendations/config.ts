import type { GlobalConfig } from "payload"
import { isAdmin } from "@/access/roles"

export const ArticleRecommendations: GlobalConfig = {
  slug: "article-recommendations",
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
      name: "runNow",
      type: "ui",
      admin: {
        components: {
          Field: "@/globals/ArticleRecommendations/components/RunNowField#RunNowField",
        },
      },
    },
    {
      name: "lastUpdated",
      type: "date",
      admin: { readOnly: true },
    },
    {
      name: "rankings",
      type: "array",
      maxRows: 20,
      admin: {
        readOnly: true,
        description:
          "Ranked articles by engagement score. Updated automatically by the recommendations script.",
      },
      fields: [
        {
          name: "article",
          type: "relationship",
          relationTo: "articles",
          required: true,
        },
        {
          name: "engagementScore",
          type: "number",
          required: true,
          admin: {
            description: "Volume-normalized scrolledUsers * recency decay",
          },
        },
      ],
    },
  ],
}
