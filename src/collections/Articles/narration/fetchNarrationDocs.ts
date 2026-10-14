import type { MediaMap } from "./extractNarrationText"

type DocId = string | number

const CHUNK_SIZE = 25

function isDocId(value: unknown): value is DocId {
  return typeof value === "string" || typeof value === "number"
}

/**
 * Reads `ids` from a collection's REST API, `CHUNK_SIZE` at a time, and maps each
 * returned doc by id. Ids are deduplicated first.
 *
 * Any response that isn't ok, or isn't a list of docs, throws: a script built from a
 * partial resolve (no byline, no alt text) must never be reported as a clean success.
 * An id the API simply doesn't return (a deleted doc) is left out of the map.
 */
export async function fetchDocsMap<T>(
  collection: string,
  ids: ReadonlyArray<DocId>,
  mapDoc: (doc: Record<string, unknown>) => T,
  options: { depth?: number } = {},
): Promise<Record<DocId, T>> {
  const unique = Array.from(new Set(ids))
  const map: Record<DocId, T> = {}
  if (unique.length === 0) return map

  const chunks: DocId[][] = []
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + CHUNK_SIZE))
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const params = chunk
        .map((id, idx) => `where[id][in][${idx}]=${encodeURIComponent(String(id))}`)
        .join("&")
      const res = await fetch(
        `/api/${collection}?${params}&depth=${options.depth ?? 0}&limit=${chunk.length}`,
      )
      if (!res.ok) {
        throw new Error(`couldn't load ${collection} (HTTP ${res.status})`)
      }
      const data: unknown = await res.json()
      const docs = (data as { docs?: unknown } | null)?.docs
      if (!Array.isArray(docs)) {
        throw new Error(`couldn't load ${collection} (unexpected response)`)
      }
      for (const doc of docs) {
        if (doc && typeof doc === "object" && isDocId(doc.id)) {
          map[doc.id] = mapDoc(doc as Record<string, unknown>)
        }
      }
    }),
  )
  return map
}

/** Author names for the byline, keyed by user id. */
export function fetchAuthorsMap(
  ids: ReadonlyArray<DocId>,
): Promise<Record<DocId, { name: string | null }>> {
  return fetchDocsMap("users", ids, (doc) => ({
    name: typeof doc.name === "string" ? doc.name : null,
  }))
}

/**
 * Alt text, caption and filename for the media an article shows, keyed by media id.
 * Depth 1 populates the uploads and blocks inside a caption's rich text, which the
 * narration describes too.
 */
export function fetchMediaMap(ids: ReadonlyArray<DocId>): Promise<MediaMap> {
  return fetchDocsMap(
    "media",
    ids,
    (doc) => ({
      alt: typeof doc.alt === "string" ? doc.alt : null,
      caption: doc.caption,
      filename: typeof doc.filename === "string" ? doc.filename : null,
    }),
    { depth: 1 },
  )
}

/**
 * The ids in the `authors` field's form state. A hasMany relationship holds bare ids
 * there; a populated `{ id }` is accepted too.
 */
export function collectAuthorIds(authors: unknown): DocId[] {
  if (!Array.isArray(authors)) return []
  const ids = authors
    .map((a: unknown) => (a && typeof a === "object" ? (a as { id?: unknown }).id : a))
    .filter(isDocId)
  return Array.from(new Set(ids))
}

/**
 * The media referenced by media blocks and collages in rich text that still needs
 * fetching: a bare id, a `{ value }` relationship, or a populated doc without alt
 * text or a caption.
 */
export function collectMediaIdsFromContent(content: unknown): DocId[] {
  const ids = new Set<DocId>()

  function addMedia(m: unknown): void {
    if (isDocId(m)) {
      ids.add(m)
    } else if (m && typeof m === "object") {
      const mediaObj = m as Record<string, unknown>
      if (isDocId(mediaObj.id)) {
        if (!mediaObj.alt && !mediaObj.caption) ids.add(mediaObj.id)
      } else if (isDocId(mediaObj.value)) {
        ids.add(mediaObj.value)
      }
    }
  }

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return
    const obj = node as Record<string, unknown>

    if (obj.type === "block" && obj.fields && typeof obj.fields === "object") {
      const fields = obj.fields as Record<string, unknown>
      if (fields.blockType === "mediaBlock" && fields.media) {
        addMedia(fields.media)
      } else if (fields.blockType === "mediaCollage" && Array.isArray(fields.images)) {
        for (const img of fields.images as unknown[]) {
          if (img && typeof img === "object") addMedia((img as Record<string, unknown>).media)
        }
      }
    }

    if (Array.isArray(obj.children)) {
      for (const child of obj.children) traverse(child)
    }
    if (obj.root && typeof obj.root === "object") traverse(obj.root)
  }

  traverse(content)
  return Array.from(ids)
}
