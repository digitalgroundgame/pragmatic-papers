import type { GlobalConfig } from "payload"

import { isEditor } from "@/access/roles"
import { postKey } from "@/components/Ticker/items"

import { revalidateTicker } from "./hooks/revalidateTicker"

/** What editors control in the ticker. Which accounts it reads is under Integrations. */
export const Ticker: GlobalConfig = {
  slug: "ticker",
  // Not `Ticker`, which is the component.
  typescript: { interface: "TickerGlobal" },
  access: {
    read: ({ req: { user } }) => isEditor(user),
    update: ({ req: { user } }) => isEditor(user),
  },
  admin: {
    hidden: ({ user }) => !isEditor(user),
    description: "The strip under the header with our live broadcasts and latest posts.",
  },
  hooks: {
    afterChange: [revalidateTicker],
  },
  fields: [
    {
      name: "hidden",
      label: "Hidden posts",
      type: "array",
      labels: { singular: "Post", plural: "Posts" },
      admin: {
        description:
          "Posts the ticker leaves out. Paste the post's link from Bluesky or X; it's gone from the ticker as soon as you save.",
        initCollapsed: false,
      },
      fields: [
        {
          name: "url",
          label: "Link to the post",
          type: "text",
          required: true,
          admin: { placeholder: "https://bsky.app/profile/…/post/…" },
          validate: (value: string | null | undefined) =>
            postKey(value ?? "") !== null ||
            "Paste a post's link from bsky.app or x.com, as its Share button copies it.",
        },
      ],
    },
  ],
}
