import type { CollectionConfig } from "payload"

import { COMMENTS_SLUG, VIOLATIONS_SLUG } from "../constants"
import type { ResolvedCommentsConfig } from "../types"

/**
 * Marks against a commenter. A check that holds a comment adds one, and so does a moderator
 * hiding one; a moderator can also add a block by hand. Enough recent ones, or any block,
 * stop the account commenting (`lockFor`) until they expire or are reversed.
 */
export function violationsCollection(config: ResolvedCommentsConfig): CollectionConfig {
  return {
    slug: VIOLATIONS_SLUG,
    labels: { singular: "Violation", plural: "Violations" },
    admin: {
      group: config.adminGroup,
      useAsTitle: "reason",
      defaultColumns: ["author", "reason", "source", "reversed", "createdAt"],
      description:
        "Too many recent violations stop an account commenting (Comment settings says how many). Tick Reversed to lift one. Add a Block to stop someone at once, until it's reversed.",
    },
    access: {
      read: config.moderators,
      create: config.moderators,
      update: config.moderators,
      delete: config.moderators,
    },
    fields: [
      {
        name: "author",
        type: "relationship",
        relationTo: config.authorsSlug,
        required: true,
        index: true,
      },
      {
        name: "source",
        type: "select",
        required: true,
        defaultValue: "block",
        options: [
          { label: "Held by a check", value: "check" },
          { label: "Hidden by a moderator", value: "moderator" },
          { label: "Block", value: "block" },
        ],
      },
      { name: "reason", type: "text", required: true },
      {
        name: "comment",
        type: "relationship",
        relationTo: COMMENTS_SLUG,
        index: true,
        admin: { readOnly: true },
      },
      {
        name: "reversed",
        type: "checkbox",
        defaultValue: false,
        index: true,
        admin: { position: "sidebar" },
      },
    ],
    timestamps: true,
  }
}
