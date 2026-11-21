import type { Field, FieldAccess } from "payload"

import type { ResolvedCommentsConfig } from "./types"

/** The field the plugin adds to each document comments are on. */
export const COMMENTING_FIELD = "commenting"

/**
 * Whether a document takes comments. `open`: anyone signed in comments. `locked`: its comments
 * stay readable, but nobody adds or replies to one. `off`: no comments show at all.
 */
export const COMMENTING = ["open", "locked", "off"] as const
export type Commenting = (typeof COMMENTING)[number]

/** A document's commenting, `open` when it has none (one made before the field). */
export const commentingOf = (doc: unknown): Commenting => {
  const value = (doc as Record<string, unknown> | null | undefined)?.[COMMENTING_FIELD]
  return COMMENTING.includes(value as Commenting) ? (value as Commenting) : "open"
}

/**
 * The sidebar choice made per document: open, locked or off. Moderators make it, and whoever
 * `commentingEditors` lets.
 */
export function commentingField(config: ResolvedCommentsConfig): Field {
  // Field access answers yes or no; a rule that answers a query counts as no.
  const chooses: FieldAccess = async (args) =>
    (await config.moderators({ req: args.req } as Parameters<typeof config.moderators>[0])) ===
      true || (await config.commentingEditors(args)) === true
  return {
    name: COMMENTING_FIELD,
    label: "Comments",
    type: "select",
    defaultValue: "open",
    options: [
      { label: "Open", value: "open" },
      { label: "Locked", value: "locked" },
      { label: "Off", value: "off" },
    ],
    access: { create: chooses, update: chooses },
    admin: {
      position: "sidebar",
      description:
        "Locked keeps its comments readable but closes them to new comments and replies. Off hides them. Readers see the change once it's published.",
    },
  }
}
