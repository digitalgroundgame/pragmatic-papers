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

/** The sidebar choice moderators make per document: open, locked or off. */
export function commentingField(config: ResolvedCommentsConfig): Field {
  // Field access answers yes or no; a moderators rule that answers a query counts as no.
  const moderates: FieldAccess = async ({ req }) =>
    (await config.moderators({ req } as Parameters<typeof config.moderators>[0])) === true
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
    access: { create: moderates, update: moderates },
    admin: {
      position: "sidebar",
      description:
        "Locked keeps its comments readable but closes them to new comments and replies. Off hides them. Readers see the change once it's published.",
    },
  }
}
