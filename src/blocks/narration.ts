import { describeVisual } from "@/utilities/describeVisual"

import type { StoredBlock } from "./types"

/** A stored string field, trimmed, or "" for anything else. */
export function spokenText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function indefiniteArticle(noun: string): "a" | "an" {
  return /^[aeiou]/i.test(noun) ? "an" : "a"
}

/**
 * The narration of a block with nothing of its own to say: "(A call to action titled "Join
 * us".)". Only human-readable title/name/label strings become a "titled" clause; slugs, ids
 * and numbers read terribly aloud and are dropped.
 */
export function describeBlockAs(noun: string, fields: StoredBlock): string {
  let titled = ""
  for (const key of ["title", "name", "label"]) {
    const value = spokenText(fields[key])
    if (value) {
      titled = ` titled "${value}"`
      break
    }
  }
  return describeVisual(`${indefiniteArticle(noun)} ${noun}${titled}`)
}

/** A descriptor's `narrate` for a block narrated by name alone (see `describeBlockAs`). */
export const narrateAs =
  (noun: string) =>
  (fields: StoredBlock): string =>
    describeBlockAs(noun, fields)
