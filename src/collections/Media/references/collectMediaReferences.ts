import type { CollectionSlug, Payload, PayloadRequest, Where } from "payload"
import { mediaIdOf, mediaInBlocks } from "./findMediaInBlocks"

export interface MediaReference {
  collection: string
  field: string
  docId: number | string
  docTitle: string
  docSlug?: string
}

export interface Source {
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
export const SOURCES: Source[] = [
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
    collection: "docs",
    drafts: true,
    titleField: "title",
    hasSlug: true,
    fields: [],
    blockFields: ["content"],
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

/** Every media id that published content uses, mapped to where it's used. */
export type MediaReferenceIndex = Map<string, MediaReference[]>

function valueAt(doc: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
      doc,
    )
}

/**
 * Reads every published document once and indexes the media each one uses. Media
 * inside rich text can't be queried for, so there's no narrower query to make; build
 * the index once and look up as many media as needed in it.
 */
export async function indexMediaReferences(payload: Payload): Promise<MediaReferenceIndex> {
  const index: MediaReferenceIndex = new Map()
  const add = (mediaId: string, reference: MediaReference): void => {
    const refs = index.get(mediaId) ?? []
    refs.push(reference)
    index.set(mediaId, refs)
  }

  for (const source of SOURCES) {
    const topLevel = [
      source.titleField,
      ...(source.hasSlug ? ["slug"] : []),
      ...source.fields,
      ...source.blockFields,
    ].map((path) => path.split(".")[0])
    const select = Object.fromEntries(topLevel.map((key) => [key, true]))
    const where: Where | undefined = source.drafts
      ? { _status: { equals: "published" } }
      : undefined

    for (let page = 1; ; page++) {
      const result = await payload.find({
        collection: source.collection,
        depth: 0,
        limit: PAGE_SIZE,
        page,
        select,
        where,
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
          const mediaId = mediaIdOf(valueAt(doc, field))
          if (mediaId !== undefined) add(mediaId, { ...reference, field })
        }
        for (const field of source.blockFields) {
          for (const [mediaId, blockTypes] of mediaInBlocks(doc[field])) {
            add(mediaId, { ...reference, field: `${field} (${blockTypes.join(", ")})` })
          }
        }
      }

      if (!result.hasNextPage) break
    }
  }

  return index
}

/** Lists the published documents that use `mediaId`. */
export async function collectMediaReferences(
  payload: Payload,
  mediaId: number | string,
): Promise<MediaReference[]> {
  const index = await indexMediaReferences(payload)
  return index.get(String(mediaId)) ?? []
}

const indexes = new WeakMap<PayloadRequest, Promise<MediaReferenceIndex>>()

/**
 * Like `collectMediaReferences`, but builds the index once per request. A bulk delete
 * runs the delete hook once per document on one request, so deleting N media reads
 * published content once instead of N times. Keyed on the request itself, not its
 * `context`, since callers may pass one context object to many separate operations.
 */
export async function mediaReferencesInRequest(
  req: PayloadRequest,
  mediaId: number | string,
): Promise<MediaReference[]> {
  let index = indexes.get(req)
  if (!index) {
    index = indexMediaReferences(req.payload)
    indexes.set(req, index)
  }
  return (await index).get(String(mediaId)) ?? []
}
