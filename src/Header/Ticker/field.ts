import type { GroupField } from "payload"

import { adminFieldLevel, editorFieldLevel } from "@/access/fields"
import { postKey } from "@/components/Ticker/items"

/** Shown while the ticker is switched on. */
const whileOn = (_: unknown, siblingData: { enabled?: boolean | null } | undefined): boolean =>
  siblingData?.enabled === true

/**
 * The Header's ticker settings: admins switch it on, and editors hide posts while it's on.
 * Which accounts it reads is under Integrations.
 */
export const tickerField: GroupField = {
  name: "ticker",
  type: "group",
  label: false,
  // Editors and admins only; the site reads it with the local API, which skips access.
  access: { read: editorFieldLevel },
  fields: [
    {
      name: "enabled",
      label: "Ticker",
      type: "checkbox",
      defaultValue: false,
      access: { update: adminFieldLevel },
      admin: {
        description:
          "The strip under the header on every page: a broadcast when one of our YouTube channels is live, and our latest posts from Bluesky and X.",
        components: {
          Field: "@/globals/SiteSettings/components/ExperimentSwitchField#ExperimentSwitchField",
        },
      },
    },
    {
      name: "posts",
      type: "ui",
      admin: {
        condition: whileOn,
        components: { Field: "@/Header/Ticker/TickerPostsField#TickerPostsField" },
      },
    },
    {
      name: "hidden",
      label: "Hidden posts",
      type: "array",
      labels: { singular: "Post", plural: "Posts" },
      admin: {
        condition: whileOn,
        description:
          "Posts the ticker leaves out: the ones hidden above, or a link pasted from Bluesky or X. It's gone from the ticker as soon as you save.",
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
