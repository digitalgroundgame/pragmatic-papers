import type { CollectionConfig } from "payload"

import { COMMENTS_SLUG, READERS_SLUG } from "../constants"
import { threadEndpoints } from "../endpoints/thread"
import type { ResolvedCommentsConfig } from "../types"

export const COMMENT_STATUSES = ["published", "hidden"] as const

/**
 * Readers' comments. They're posted through `POST /api/comments/thread/:id`, never created in
 * the admin, and moderators can't change what a reader wrote: they hide a comment or delete it.
 */
export function commentsCollection(config: ResolvedCommentsConfig): CollectionConfig {
  return {
    slug: COMMENTS_SLUG,
    labels: { singular: "Comment", plural: "Comments" },
    admin: {
      group: config.adminGroup,
      useAsTitle: "body",
      defaultColumns: ["body", "reader", "target", "status", "createdAt"],
      description: "Readers' comments. Hide one to take it off the page, or delete it.",
    },
    access: {
      create: () => false,
      read: config.moderators,
      update: config.moderators,
      delete: config.moderators,
    },
    endpoints: threadEndpoints(config),
    fields: [
      {
        name: "body",
        type: "textarea",
        required: true,
        maxLength: config.maxLength,
        admin: { readOnly: true },
      },
      {
        name: "target",
        label: "On",
        type: "relationship",
        relationTo: config.targetSlug,
        required: true,
        index: true,
        admin: { readOnly: true },
      },
      {
        name: "reader",
        type: "relationship",
        relationTo: READERS_SLUG,
        required: true,
        index: true,
        admin: { readOnly: true },
      },
      {
        name: "status",
        type: "select",
        required: true,
        defaultValue: "published",
        options: [
          { label: "Published", value: "published" },
          { label: "Hidden", value: "hidden" },
        ],
        admin: { position: "sidebar" },
      },
    ],
    timestamps: true,
  }
}
