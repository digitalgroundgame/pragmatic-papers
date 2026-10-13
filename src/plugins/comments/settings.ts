import type { GlobalConfig, GlobalSlug, Payload } from "payload"

import { DEFAULT_SETTINGS, SETTINGS_SLUG } from "./constants"
import type { CommentSettings, ResolvedCommentsConfig } from "./types"

/** The admin's settings for comments: replies, the checks, and when violations lock. */
export function settingsGlobal(config: ResolvedCommentsConfig): GlobalConfig {
  return {
    slug: SETTINGS_SLUG,
    label: "Comment settings",
    admin: { group: config.adminGroup },
    access: { read: config.moderators, update: config.admins },
    fields: [
      {
        name: "maxDepth",
        label: "Reply depth",
        type: "number",
        required: true,
        min: 0,
        max: 10,
        defaultValue: DEFAULT_SETTINGS.maxDepth,
        admin: {
          description:
            "How many levels of replies can sit below a top-level comment. 0 allows no replies. Lowering it never removes replies already posted; it only stops new ones past the limit.",
        },
      },
      {
        type: "row",
        fields: [
          {
            name: "violationThreshold",
            label: "Violations before a lock",
            type: "number",
            required: true,
            min: 1,
            defaultValue: DEFAULT_SETTINGS.violationThreshold,
            admin: {
              description:
                "An account with this many active violations can't comment until enough of them expire or are reversed.",
            },
          },
          {
            name: "violationWindowDays",
            label: "Violations expire after (days)",
            type: "number",
            required: true,
            min: 1,
            defaultValue: DEFAULT_SETTINGS.violationWindowDays,
          },
        ],
      },
      {
        name: "maxLinks",
        label: "Links per comment",
        type: "number",
        required: true,
        min: 0,
        defaultValue: DEFAULT_SETTINGS.maxLinks,
        admin: { description: "A comment with more links than this is held for a moderator." },
      },
      {
        name: "blockDuplicates",
        label: "Hold repeated comments",
        type: "checkbox",
        defaultValue: DEFAULT_SETTINGS.blockDuplicates,
        admin: {
          description: "Hold a comment its author already posted, word for word, in the past day.",
        },
      },
    ],
  }
}

/** The settings, with defaults for any an admin hasn't saved. */
export async function readSettings(payload: Payload): Promise<CommentSettings> {
  const saved = (await payload.findGlobal({
    slug: SETTINGS_SLUG as GlobalSlug,
    depth: 0,
    overrideAccess: true,
  })) as Partial<Record<keyof CommentSettings, unknown>>
  const number = (key: keyof CommentSettings) =>
    typeof saved[key] === "number" ? (saved[key] as number) : (DEFAULT_SETTINGS[key] as number)
  return {
    maxDepth: number("maxDepth"),
    violationThreshold: number("violationThreshold"),
    violationWindowDays: number("violationWindowDays"),
    maxLinks: number("maxLinks"),
    blockDuplicates:
      typeof saved.blockDuplicates === "boolean"
        ? saved.blockDuplicates
        : DEFAULT_SETTINGS.blockDuplicates,
  }
}
