import type { CollectionSlug, Payload, Where } from "payload"
import { findMediaInBlocks, isMediaId } from "./findMediaInBlocks"

export interface MediaReference {
  collection: string
  field: string
  docId: number | string
  docTitle: string
  docSlug?: string
}

interface Source {
  collection: CollectionSlug
  /** Only published documents count; drafts may still point at media that is deleted. */
  drafts: boolean
  titleField: "title" | "name"
  hasSlug: boolean
  /** Upload fields, as dotted paths, that hold a media id directly. */
  fields: string[]
  /** Rich text or `blocks` fields to search for media blocks. */
  blockFields: string[]
}

/**
 * Every place published content can use media. Adding an upload field, or a block
 * that holds media (see `MEDIA_IN_BLOCK`), means adding it here too, or media it
 * uses can be deleted out from under it.
 */
const SOURCES: Source[] = [
  {
    collection: "articles",
    drafts: true,
    titleField: "title",
    hasSlug: true,
    fields: ["heroImage", "narration", "meta.image"],
    blockFields: ["content"],
  },
  {
    collection: "pages",
    drafts: true,
    titleField: "title",
    hasSlug: true,
    fields: ["hero.media", "meta.image"],
    blockFields: ["layout"],
  },
  {
    collection: "volumes",
    drafts: true,
    titleField: "title",
    hasSlug: true,
    fields: ["meta.image"],
    blockFields: ["editorsNote"],
  },
  {
    collection: "interactives",
    drafts: true,
    titleField: "title",
    hasSlug: true,
    fields: ["meta.image"],
    blockFields: [],
  },
  {
    collection: "topics",
    drafts: false,
    titleField: "name",
    hasSlug: true,
    fields: ["meta.image"],
    blockFields: [],
  },
  {
    collection: "users",
    drafts: false,
    titleField: "name",
    hasSlug: false,
    fields: ["profileImage"],
    blockFields: [],
  },
]

const PAGE_SIZE = 100

function valueAt(doc: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
      doc,
    )
}

function whereFor(source: Source, mediaId: number | string): Where {
  const and: Where[] = []
  if (source.drafts) and.push({ _status: { equals: "published" } })
  // Media inside rich text can't be queried for, so a source with block fields reads
  // every published document; one without narrows to the documents that use it.
  if (source.blockFields.length === 0) {
    and.push({ or: source.fields.map((field) => ({ [field]: { equals: mediaId } })) })
  }
  return { and }
}

/** Lists the published documents that use `mediaId`. */
export async function collectMediaReferences(
  payload: Payload,
  mediaId: number | string,
): Promise<MediaReference[]> {
  const refs: MediaReference[] = []

  for (const source of SOURCES) {
    const topLevel = [
      source.titleField,
      ...(source.hasSlug ? ["slug"] : []),
      ...source.fields,
      ...source.blockFields,
    ].map((path) => path.split(".")[0])
    const select = Object.fromEntries(topLevel.map((key) => [key, true]))

    for (let page = 1; ; page++) {
      const result = await payload.find({
        collection: source.collection,
        depth: 0,
        limit: PAGE_SIZE,
        page,
        select,
        where: whereFor(source, mediaId),
        overrideAccess: true,
      })

      for (const doc of result.docs as unknown as Record<string, unknown>[]) {
        const reference = {
          collection: source.collection,
          docId: doc.id as number | string,
          docTitle: (doc[source.titleField] as string | undefined) || "Untitled",
          docSlug: source.hasSlug ? ((doc.slug as string | null) ?? undefined) : undefined,
        }

        for (const field of source.fields) {
          if (isMediaId(valueAt(doc, field), mediaId)) refs.push({ ...reference, field })
        }
        for (const field of source.blockFields) {
          const blockTypes = findMediaInBlocks(doc[field], mediaId)
          if (blockTypes.length > 0) {
            refs.push({ ...reference, field: `${field} (${blockTypes.join(", ")})` })
          }
        }
      }

      if (!result.hasNextPage) break
    }
  }

  return refs
}
