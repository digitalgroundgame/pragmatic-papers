import type { Article } from "@/payload-types"
import { isRecord } from "@/utilities/isRecord"
import type { FieldHook } from "payload"

/**
 * The fields readers see on the article's page. A published save that leaves every one of
 * them alone (ticking Syndicate to Substack, adding a topic, editing the SEO tab) isn't an
 * update to the article, so it keeps the "Updated" line and `dateModified` where they were.
 */
export const READER_FIELDS = ["title", "content", "heroImage", "authors", "narration"] as const

type ReaderFields = Partial<Pick<Article, (typeof READER_FIELDS)[number]>>

/**
 * A value with relationships reduced to their ids, objects' keys sorted and empty values
 * dropped, so the copy an editor submits and the one Postgres hands back compare equal:
 * `jsonb` reorders the rich text's keys, and the admin sends `heroImage: null` where the
 * row has none.
 */
function normalize(value: unknown): unknown {
  if (value == null) return undefined
  if (Array.isArray(value)) return value.map(normalize)
  if (!isRecord(value)) return value
  // A populated relationship: only which document it points at matters.
  if ("id" in value && ("createdAt" in value || "updatedAt" in value)) return value.id
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalize(value[key])])
      .filter(([, v]) => v !== undefined),
  )
}

/** Whether readers would see a difference between two copies of an article. */
export function readerContentChanged(before: ReaderFields, after: ReaderFields): boolean {
  return READER_FIELDS.some(
    (field) => JSON.stringify(normalize(before[field])) !== JSON.stringify(normalize(after[field])),
  )
}

const selectReaderFields = Object.fromEntries(READER_FIELDS.map((field) => [field, true])) as {
  [K in (typeof READER_FIELDS)[number]]: true
}

type ReadersRow = ReaderFields & Pick<Article, "contentUpdatedAt" | "_status">

/**
 * `contentUpdatedAt`: when readers last saw the article change. Payload stamps `updatedAt`
 * on every save, so it moves when an editor ticks a sidebar box and publishes. This moves
 * only when a published save changes a field in `READER_FIELDS`, and starts at
 * `publishedAt` on the first publish. Draft saves carry the published copy's value along.
 *
 * It compares with the article's own row (`draft: false`), not `originalDoc`: Payload hands
 * hooks the latest version, which is an autosaved draft once an editor has typed, and that
 * draft already holds the edit being published.
 */
export const setContentUpdatedAt: FieldHook<Article, Article["contentUpdatedAt"]> = async ({
  operation,
  originalDoc,
  req,
  siblingData,
}) => {
  const id = originalDoc?.id
  const row: ReadersRow | null =
    operation === "update" && id != null
      ? ((await req.payload
          .findByID({
            collection: "articles",
            id,
            draft: false,
            depth: 0,
            req,
            overrideAccess: true,
            select: { contentUpdatedAt: true, _status: true, ...selectReaderFields },
          })
          .catch(() => null)) as ReadersRow | null)
      : null
  const kept = row?.contentUpdatedAt ?? null

  const status = siblingData._status ?? originalDoc?._status
  if (status !== "published") return kept

  // Never published (or published before this field existed and never backfilled).
  if (!row || !kept) return siblingData.publishedAt ?? new Date().toISOString()

  const after = Object.fromEntries(
    READER_FIELDS.map((field) => [
      field,
      field in siblingData ? siblingData[field] : originalDoc?.[field],
    ]),
  ) as ReaderFields

  return readerContentChanged(row, after) ? new Date().toISOString() : kept
}
