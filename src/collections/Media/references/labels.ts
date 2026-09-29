import type { MediaReference } from "./collectMediaReferences"

const COLLECTION_LABELS: Record<string, string> = {
  articles: "Article",
  pages: "Page",
  volumes: "Volume",
  interactives: "Interactive",
  topics: "Topic",
  users: "User",
}

const FIELD_LABELS: Record<string, string> = {
  heroImage: "hero image",
  narration: "narration audio",
  "meta.image": "SEO image",
  "hero.media": "hero",
  profileImage: "profile image",
  content: "content",
  layout: "page layout",
  editorsNote: "editor's note",
}

export function collectionLabel(collection: string): string {
  return COLLECTION_LABELS[collection] ?? collection.charAt(0).toUpperCase() + collection.slice(1)
}

/** "content (mediaBlock, timeline)" reads as "content"; the block types are detail. */
export function fieldLabel(field: string): string {
  const base = field.split(" (")[0] ?? field
  return FIELD_LABELS[base] ?? base
}

export function adminUrl(reference: Pick<MediaReference, "collection" | "docId">): string {
  return `/admin/collections/${reference.collection}/${reference.docId}`
}

export interface ReferencingDocument {
  collection: string
  docId: number | string
  docTitle: string
  fields: string[]
}

/** One entry per document, with every field of it that uses the media. */
export function groupByDocument(references: MediaReference[]): ReferencingDocument[] {
  const documents = new Map<string, ReferencingDocument>()
  for (const ref of references) {
    const key = `${ref.collection}/${ref.docId}`
    const document = documents.get(key) ?? {
      collection: ref.collection,
      docId: ref.docId,
      docTitle: ref.docTitle,
      fields: [],
    }
    const label = fieldLabel(ref.field)
    if (!document.fields.includes(label)) document.fields.push(label)
    documents.set(key, document)
  }
  return [...documents.values()]
}

function joinWithAnd(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/** How many documents a refused delete names before pointing at the References tab. */
export const NAMED_IN_REFUSAL = 3

/**
 * The message an editor sees when a delete is refused: which documents use the
 * media, and what to do about it.
 */
export function describeRefusal(references: MediaReference[]): string {
  const documents = groupByDocument(references)
  const named = documents
    .slice(0, NAMED_IN_REFUSAL)
    .map(
      (document) =>
        `"${document.docTitle}" (${collectionLabel(document.collection).toLowerCase()} ${document.fields.join(", ")})`,
    )
  const more = documents.length - named.length

  if (documents.length === 1) {
    return `Can't delete: it's used in ${named[0]}. Replace or remove it there first.`
  }
  const list = more > 0 ? `${named.join(", ")} and ${more} more` : joinWithAnd(named)
  return (
    `Can't delete: it's used in ${documents.length} published documents: ${list}. ` +
    "Replace or remove it there first; the References tab lists them all."
  )
}
