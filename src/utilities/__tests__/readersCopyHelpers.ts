import { type Mock, vi } from "vitest"

/** A collection with drafts, as Payload hands it to a hook. */
export const draftsCollection = (
  slug: string,
): { slug: string; versions: { drafts: { autosave: boolean } } } => ({
  slug,
  versions: { drafts: { autosave: true } },
})

/**
 * A `payload.findByID` for `readersChange`: the collection's own row, which is what readers
 * see. A draft unless `row` says otherwise.
 */
export const readersRow = (row: Record<string, unknown> = {}): Mock =>
  vi.fn(async ({ id }: { id: unknown }) => ({ id, _status: "draft", ...row }))
