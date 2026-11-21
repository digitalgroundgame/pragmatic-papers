import type { CollectionConfig, Field } from "payload"

import { READS_SLUG, VISITS_FIELD } from "./constants"
import type { ResolvedReadingConfig } from "./types"

const nobody = () => false

/**
 * One row per reader per article read, written only by the plugin's endpoint. Rows rather than
 * a count, so a rule can ask which articles someone read (every article in a volume) and a new
 * one can count what they read before it existed.
 */
export function readsCollection(config: ResolvedReadingConfig): CollectionConfig {
  return {
    slug: READS_SLUG,
    labels: { singular: "Article read", plural: "Articles read" },
    admin: {
      // Off the sidebar: it's a record for rules to count, not something to edit.
      group: false,
      defaultColumns: ["user", "article", "readAt"],
    },
    access: {
      read: config.readers,
      create: nobody,
      update: nobody,
      delete: nobody,
    },
    indexes: [{ fields: ["user", "article"], unique: true }],
    fields: [
      {
        name: "user",
        type: "relationship",
        relationTo: config.usersSlug,
        required: true,
        index: true,
      },
      {
        name: "article",
        type: "relationship",
        relationTo: config.articlesSlug,
        required: true,
        index: true,
      },
      {
        name: "readAt",
        label: "Read",
        type: "date",
        required: true,
        admin: { date: { pickerAppearance: "dayAndTime" } },
      },
    ],
    timestamps: false,
  }
}

/**
 * The days a reader visited, kept on their account: a row per day would only ever be counted.
 * Written by the plugin's endpoint alone, at most once a day.
 */
export const visitsField = (config: ResolvedReadingConfig): Field => ({
  name: VISITS_FIELD,
  label: "Visits",
  type: "group",
  access: {
    // A field can only be shown or hidden: a query constraint from `readers` hides it.
    read: async (args) => (await config.readers(args as never)) === true,
    create: nobody,
    update: nobody,
  },
  admin: {
    position: "sidebar",
    readOnly: true,
    description: "Days this account visited the site while signed in, on its own calendar.",
  },
  fields: [
    { name: "daysVisited", label: "Days visited", type: "number", defaultValue: 0 },
    { name: "lastVisitOn", label: "Last visit", type: "text" },
    { name: "currentStreak", label: "Current streak", type: "number", defaultValue: 0 },
    { name: "longestStreak", label: "Longest streak", type: "number", defaultValue: 0 },
  ],
})
