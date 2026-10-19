import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Doc } from "@/payload-types"
import {
  lastOffered,
  markOffered,
  markSeeded,
  type OfferedRevision,
  wasSeeded,
} from "@/utilities/seedOnce"
import type { Payload } from "payload"

import { DOCS_SLUG } from "./collection"
import { imagesIn, parseDocFile } from "./docFile"
import { docsEditorConfig, markdownToContent } from "./markdown"
import { hashRepoDoc, mediaFilename, mediaRefsIn, type RepoDoc, unpackMedia } from "./repoDoc"
import { DOCS_DIR, listDocFiles } from "./repoDocFiles"

const MIME_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mp4: "video/mp4",
  png: "image/png",
  svg: "image/svg+xml",
  webm: "video/webm",
  webp: "image/webp",
}

export interface SyncResult {
  /** Docs new to this site, created as drafts for an editor to publish. */
  created: string[]
  /**
   * Docs the site has whose repo copy changed since it was last offered, saved as a new draft
   * version for an editor to publish, edit or discard. The published version is untouched.
   */
  offered: string[]
  /**
   * Docs whose repo copy changed, left alone because an editor has a draft of their own on top
   * of the published version. Not recorded as offered, so a later deploy offers it once that
   * draft is published or discarded.
   */
  skipped: string[]
  /** Docs the site already has, with nothing new to offer. */
  existing: string[]
  /** Docs seeded here before and deleted since, which stay deleted. */
  deleted: string[]
}

/** What a sync does with one repo doc. */
export type RepoDocAction =
  /** The site has never had it: create it. */
  | "create"
  /** Seeded before and deleted since: leave it deleted. */
  | "deleted"
  /**
   * The site has it and was never offered a revision (it predates offers), and holds the repo's
   * copy already or was written by an editor: record the repo's hash as offered.
   */
  | "baseline"
  /** The repo's copy is the one last offered: nothing to do. */
  | "unchanged"
  /** The repo's copy changed: save it as a new draft version. */
  | "offer"
  /** The repo's copy changed, but an editor has a draft of their own: leave it for later. */
  | "editorDraft"

export interface RepoDocState {
  /** Whether the site has a doc with this slug, draft or published. */
  exists: boolean
  /** Whether a deploy seeded it here, or found it here, before (`wasSeeded`). */
  seeded: boolean
  /** The revision last offered (`lastOffered`). */
  offered: OfferedRevision | null
  /** The `sourceHash` the site's doc was saved with, for a doc never offered a revision. */
  sourceHash?: string | null
  /** The doc's latest version, the one the admin opens. */
  latest: LatestVersion | null
  /** The hash of the repo's copy (`hashRepoDoc`). */
  hash: string
  localSeed: boolean
}

export interface LatestVersion {
  id: number | string
  status: "draft" | "published" | null
}

/**
 * Decides what a sync does with one repo doc. Code never publishes, overwrites the published
 * version or deletes: a change reaches a site that has the doc only as a new draft version, and
 * only when the latest version isn't an editor's unpublished work. A latest draft is the
 * deploy's own when it's the version the last offer saved, so a suggestion nobody has touched
 * is superseded by a newer one rather than left waiting.
 */
export function planRepoDoc({
  exists,
  seeded,
  offered,
  sourceHash,
  latest,
  hash,
  localSeed,
}: RepoDocState): RepoDocAction {
  if (!exists) return seeded && !localSeed ? "deleted" : "create"
  // A doc seeded before offers began has no offer recorded; the hash it was saved with says
  // whether the repo has changed it since. Any draft it has then is an editor's. One an editor
  // wrote here has no hash, and gets only later changes.
  if (!offered && (!sourceHash || sourceHash === hash)) return "baseline"
  if (offered?.hash === hash) return "unchanged"
  const editorsDraft =
    latest?.status === "draft" &&
    (offered?.version === undefined || String(latest.id) !== String(offered.version))
  return editorsDraft ? "editorDraft" : "offer"
}

export interface SyncOptions {
  /**
   * For the local seed, which has just wiped every doc: publish the docs it creates, and seed
   * docs again that it seeded before. On a deployed site a doc from the repo waits for an
   * editor, so nothing reaches readers or the bell unread by a person, and one an editor
   * deleted stays deleted.
   */
  localSeed?: boolean
}

const context = { disableRevalidate: true }

/** The Media id for a doc's file, uploading it the first time this content is seen. */
async function uploadOnce(
  payload: Payload,
  file: string,
  bytes: Buffer,
  ref: { alt?: string | null; caption?: unknown },
): Promise<number | string> {
  const filename = mediaFilename(file, bytes)
  // Matched without its extension: Media converts images to WebP, so a PNG is stored as .webp,
  // and adds a number to a name already taken on disk.
  const stem = filename.slice(0, filename.length - path.extname(filename).length)
  const { docs } = await payload.find({
    collection: "media",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { filename: { like: stem } },
  })
  if (docs[0]) return docs[0].id

  const extension = path.extname(file).slice(1).toLowerCase()
  const media = await payload.create({
    collection: "media",
    context,
    overrideAccess: true,
    data: { alt: ref.alt ?? "", ...(ref.caption ? { caption: ref.caption as never } : {}) },
    file: {
      data: bytes,
      mimetype: MIME_TYPES[extension] ?? "application/octet-stream",
      name: filename,
      size: bytes.length,
    },
  })
  return media.id
}

/** The doc's latest version, the one the admin opens, or null if it has none. */
async function latestVersion(payload: Payload, id: number | string): Promise<LatestVersion | null> {
  const { docs } = await payload.findVersions({
    collection: DOCS_SLUG,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    sort: "-updatedAt",
    // As Payload finds the version the admin opens (`getLatestCollectionVersion`).
    where: { and: [{ parent: { equals: id } }, { latest: { equals: true } }] },
  })
  const version = docs[0]
  return version ? { id: version.id, status: version.version._status ?? null } : null
}

/**
 * Seeds this site's database with each doc in `dir` it has never had, as a draft, with its
 * files uploaded to Media, and offers the repo's changes to a doc it has as a new draft
 * version (`planRepoDoc` decides which). Code never publishes, never overwrites the published
 * version and never deletes, so editors own a doc from the moment it arrives and decide what
 * readers see. Each doc is recorded as seeded (`markSeeded`), so one an editor deletes isn't
 * seeded again, and each revision as offered (`markOffered`), so one an editor discards isn't
 * offered again.
 */
export async function syncDocs(
  payload: Payload,
  dir = DOCS_DIR,
  { localSeed = false }: SyncOptions = {},
): Promise<SyncResult> {
  const result: SyncResult = {
    created: [],
    offered: [],
    skipped: [],
    existing: [],
    deleted: [],
  }
  if (!existsSync(dir)) {
    // A deploy without the folder (a runtime with no file system for it) would otherwise
    // look like one with nothing to sync.
    payload.logger.warn(`No help docs to sync: ${dir} doesn't exist here`)
    return result
  }

  const entries = await listDocFiles(dir)
  // Each doc the site has by slug, so a new doc is seeded under its folder's doc. Parents come
  // first in `entries`, so one created here is in it by the time its docs are.
  const ids = new Map<string, number | string>()
  let editorConfig: ReturnType<typeof docsEditorConfig> | undefined
  for (const { slug, parent, folder, file } of entries) {
    const seeded = await wasSeeded(payload, DOCS_SLUG, slug)
    const { docs } = await payload.find({
      collection: DOCS_SLUG,
      depth: 0,
      draft: true,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      select: { slug: true, sourceHash: true },
      where: { slug: { equals: slug } },
    })
    const existing = docs[0]
    if (existing) ids.set(slug, existing.id)
    if (existing && !seeded) {
      // Recorded too, so a doc the site had before seeding was recorded stays deleted once an
      // editor deletes it.
      await markSeeded(payload, DOCS_SLUG, slug)
    }
    if (!existing && seeded && !localSeed) {
      result.deleted.push(slug)
      continue
    }

    const source = await readFile(file, "utf8")
    const { meta, body } = parseDocFile(source, path.relative(dir, file))
    const refs = mediaRefsIn([
      meta.heroImage ? { $media: meta.heroImage, alt: meta.heroAlt } : [],
      imagesIn(body).map((image) => ({ $media: image.file, alt: image.alt })),
    ])
    const files = await Promise.all(refs.map((ref) => readFile(path.join(folder, ref.$media))))
    const hash = hashRepoDoc(source, files)

    const offered = existing ? await lastOffered(payload, DOCS_SLUG, slug) : null
    const savedHash = offered ? offered.hash : (existing?.sourceHash ?? hash)
    const latest = existing && savedHash !== hash ? await latestVersion(payload, existing.id) : null
    const action = planRepoDoc({
      exists: Boolean(existing),
      seeded,
      offered,
      sourceHash: existing?.sourceHash,
      latest,
      hash,
      localSeed,
    })
    if (action === "baseline") await markOffered(payload, DOCS_SLUG, slug, hash)
    if (action === "baseline" || action === "unchanged") {
      result.existing.push(slug)
      continue
    }
    if (action === "editorDraft") {
      result.skipped.push(slug)
      continue
    }
    if (action === "deleted") {
      result.deleted.push(slug)
      continue
    }

    const mediaIds = new Map<string, number | string>()
    for (const [i, ref] of refs.entries()) {
      mediaIds.set(ref.$media, await uploadOnce(payload, ref.$media, files[i]!, ref))
    }

    // Converted only for a doc it creates or offers: a deploy reads every doc.
    editorConfig ??= docsEditorConfig(payload.config)
    const { heroAlt, heroImage, ...rest } = meta
    const repoDoc: RepoDoc = {
      ...rest,
      ...(heroImage ? { heroImage: { $media: heroImage, alt: heroAlt } } : {}),
      parent,
      content: markdownToContent(slug, body, editorConfig),
    }
    const publish = localSeed && action === "create"
    const data = {
      title: repoDoc.title,
      navTitle: repoDoc.navTitle ?? null,
      summary: repoDoc.summary,
      publishedAt: repoDoc.publishedAt,
      revisedAt: repoDoc.revisedAt ?? null,
      heroImage: repoDoc.heroImage ? (unpackMedia(repoDoc.heroImage, mediaIds) as number) : null,
      audience: (repoDoc.audience ?? []) as Doc["audience"],
      showTableOfContents: repoDoc.showTableOfContents ?? true,
      tour: repoDoc.tour ?? null,
      content: unpackMedia(repoDoc.content, mediaIds) as never,
      slug,
      sourceHash: hash,
      _status: publish ? ("published" as const) : ("draft" as const),
    }

    let id: number | string
    if (action === "offer") {
      // Saved as a draft, it's a new version only: the published doc stays as it is, and the
      // admin shows the doc as Changed, with the suggestion to compare in its Versions tab.
      // Where the doc sits is the site's: an editor may have moved it, so an offer leaves it.
      id = existing!.id
      await payload.update({
        collection: DOCS_SLUG,
        id,
        data,
        context,
        draft: true,
        overrideAccess: true,
      })
      result.offered.push(slug)
    } else {
      // Under its folder's doc; at the top when the site has none (an editor deleted it).
      const parentId = repoDoc.parent ? (ids.get(repoDoc.parent) ?? null) : null
      id = (
        await payload.create({
          collection: DOCS_SLUG,
          data: { ...data, parent: parentId as number | null },
          context,
          draft: !publish,
          overrideAccess: true,
        })
      ).id
      ids.set(slug, id)
      await markSeeded(payload, DOCS_SLUG, slug)
      result.created.push(slug)
    }
    // The version just saved, so the next deploy knows a latest draft with this id is its own.
    await markOffered(payload, DOCS_SLUG, slug, hash, (await latestVersion(payload, id))?.id)
  }
  return result
}
