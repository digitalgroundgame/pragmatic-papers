import type { CollectionConfig } from "payload"

import { COMMENTS_SLUG } from "../constants"
import { threadEndpoints } from "../endpoints/thread"
import { deleteReplies } from "../hooks/deleteReplies"
import { recordModeration } from "../hooks/recordModeration"
import type { ResolvedCommentsConfig } from "../types"

/**
 * Comments. They're posted through `POST /api/comments/thread/:id`, never created in the
 * admin, and moderators can't change what anyone wrote: they hide a comment, restore one,
 * or delete it.
 */
export function commentsCollection(config: ResolvedCommentsConfig): CollectionConfig {
  return {
    slug: COMMENTS_SLUG,
    labels: { singular: "Comment", plural: "Comments" },
    admin: {
      group: config.adminGroups.comments,
      useAsTitle: "body",
      defaultColumns: ["body", "author", "target", "status", "createdAt"],
      description:
        "Hide a comment to take it off the page and count it against its author; replies to it stay. Publish a held or hidden one to restore it and reverse its violation. Deleting a comment deletes its replies too.",
    },
    access: {
      create: () => false,
      read: config.moderators,
      update: config.moderators,
      delete: config.moderators,
    },
    endpoints: threadEndpoints(config),
    hooks: {
      afterChange: [recordModeration],
      beforeDelete: [deleteReplies],
    },
    fields: [
      {
        name: "body",
        type: "textarea",
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
        // Empty once the author's account is deleted.
        name: "author",
        type: "relationship",
        relationTo: config.authorsSlug,
        index: true,
        admin: { readOnly: true },
      },
      {
        name: "parent",
        label: "Reply to",
        type: "relationship",
        relationTo: COMMENTS_SLUG,
        index: true,
        admin: { readOnly: true },
      },
      {
        // 0 for a top-level comment. Fixed when it's posted, so a later change to the
        // settings' reply depth never moves it.
        name: "depth",
        type: "number",
        required: true,
        defaultValue: 0,
        admin: { readOnly: true, position: "sidebar" },
      },
      {
        name: "status",
        type: "select",
        required: true,
        defaultValue: "published",
        index: true,
        options: [
          { label: "Published", value: "published" },
          { label: "Held by a check", value: "auto-hidden" },
          { label: "Hidden", value: "hidden" },
          { label: "Deleted by its author", value: "deleted" },
        ],
        admin: { position: "sidebar" },
      },
      {
        name: "moderationReason",
        label: "Why it was held",
        type: "text",
        admin: {
          readOnly: true,
          position: "sidebar",
          condition: (data) => Boolean(data?.moderationReason),
        },
      },
    ],
    timestamps: true,
  }
}
