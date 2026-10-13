import type { CollectionConfig } from "payload"

import { READERS_SLUG } from "../constants"
import { deleteCommentsOn } from "../hooks/deleteCommentsOn"
import type { ResolvedCommentsConfig } from "../types"

/**
 * The people who sign in to comment. Better Auth creates them on their first provider login
 * and keeps their sessions in its own tables; nobody creates one in the admin, and they have
 * no way into it. Moderators can ban one, which stops them posting, or delete one with every
 * comment they wrote.
 */
export function readersCollection(config: ResolvedCommentsConfig): CollectionConfig {
  const never = () => false
  return {
    slug: READERS_SLUG,
    labels: { singular: "Reader", plural: "Readers" },
    admin: {
      group: config.adminGroup,
      useAsTitle: "name",
      defaultColumns: ["name", "email", "banned", "createdAt"],
      description: "People who signed in to comment. They're created by signing in, never here.",
    },
    access: {
      create: never,
      read: config.moderators,
      update: config.moderators,
      delete: config.moderators,
    },
    // A reader removed by a moderator takes their comments with them.
    hooks: { beforeDelete: [deleteCommentsOn("reader")] },
    fields: [
      // The name and picture their provider shared, shown beside their comments.
      { name: "name", type: "text", required: true, admin: { readOnly: true } },
      { name: "email", type: "email", required: true, unique: true, admin: { readOnly: true } },
      {
        name: "banned",
        type: "checkbox",
        defaultValue: false,
        admin: {
          position: "sidebar",
          description: "Stops them posting. Their comments stay until you hide or delete them.",
        },
      },
      // Better Auth's record that a provider vouched for the address.
      {
        name: "emailVerified",
        type: "checkbox",
        defaultValue: false,
        access: { create: never, update: never },
        admin: { hidden: true },
      },
      {
        name: "avatarUrl",
        type: "text",
        access: { create: never, update: never },
        admin: { readOnly: true, position: "sidebar" },
      },
    ],
    timestamps: true,
  }
}
