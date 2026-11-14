import { createHash } from "node:crypto"

import type { Interactive, InteractiveSnapshot } from "@/payload-types"
import { stableStringify } from "../hash"
import type { WhipCountData } from "./model"

export { isWhipCountData } from "./model"

/** What a whip count snapshot holds: how many voters and where they stand. */
export function describeWhipCount(data: WhipCountData): string {
  const declared = data.members.filter((m) => m.stance !== "undeclared").length
  return `${data.members.length} voters · ${declared} on the record · as of ${data.asOf}`
}

/** A hash of the whole count: a push that changes nothing writes nothing. */
export const hashWhipCount = (data: WhipCountData): string =>
  createHash("sha256").update(stableStringify(data)).digest("hex").slice(0, 16)

/**
 * The provenance fields a snapshot records for a whip count, worked out from the count
 * itself. The push route writes them with a new count, and the snapshot collection stamps
 * them again whenever an editor changes the count in its table.
 */
export function whipCountSnapshotStamp(
  data: WhipCountData,
  now: Date,
): Pick<InteractiveSnapshot, "summary" | "sourceVersion" | "contentHash" | "syncedAt"> {
  return {
    summary: describeWhipCount(data),
    sourceVersion: data.asOf,
    contentHash: hashWhipCount(data),
    syncedAt: now.toISOString(),
  }
}

/** Every field a new whip count snapshot needs. `source` says what wrote it ("push", "seed"). */
export function whipCountSnapshotFields(
  interactive: Pick<Interactive, "id" | "title">,
  data: WhipCountData,
  { source, now }: { source: string; now: Date },
): Omit<InteractiveSnapshot, "id" | "createdAt" | "updatedAt"> {
  return {
    label: `${interactive.title} — whip count`,
    interactive: interactive.id,
    sourceRef: source,
    generatedAt: now.toISOString(),
    // Spread into a plain object: the JSON field's type wants an index signature.
    data: { ...data },
    ...whipCountSnapshotStamp(data, now),
  }
}
