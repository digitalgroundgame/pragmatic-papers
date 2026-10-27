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
import {
  hashRepoDoc,
  legacyRepoDocHash,
  mediaFilename,
  mediaRefsIn,
  type RepoDoc,
  unpackMedia,
} from "./repoDoc"
import { DOCS_DIR, listDocFiles } from "./repoDocFiles"
import {
  changedFiles,
  type DocBaseline,
  hashFile,
  readBaseline,
  saveBaseline,
  suggestChange,
} from "./suggest"

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
  /** Docs new to this site, created as drafts for an editor to rewrite and publish. */
  created: string[]
  /**
   * Docs the site has whose repo copy changed since it last took one in: what changed is listed
   * beside the doc as a suggestion (`suggestChange`). The doc itself is untouched.
   */
  suggested: string[]
  /** Docs the site already has, with nothing new to suggest. */
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
   * copy already or was written by an editor: record the repo's copy as the one it has seen.
   */
  | "baseline"
  /** The repo's copy is the one the site last took in: nothing to do. */
  | "unchanged"
  /** The repo's copy changed: list what changed beside the doc. */
  | "suggest"

export interface RepoDocState {
  /** Whether the site has a doc with this slug, draft or published. */
  exists: boolean
  /** Whether a deploy seeded it here, or found it here, before (`wasSeeded`). */
  seeded: boolean
  /** The revision last offered (`lastOffered`). */
  offered: OfferedRevision | null
  /** The `sourceHash` the site's doc was saved with, for a doc never offered a revision. */
  sourceHash?: string | null
  /** The hash of the repo's copy (`hashRepoDoc`). */
  hash: string
  localSeed: boolean
}

/**
 * Decides what a sync does with one repo doc. Code never publishes, changes or deletes a doc a
 * site has: the repo seeds it once, as a first draft, and a later change reaches the site only
 * as a suggestion beside the doc, for its editors to work in by hand.
 */
export function planRepoDoc({
  exists,
  seeded,
  offered,
  sourceHash,
  hash,
  localSeed,
}: RepoDocState): RepoDocAction {
  if (!exists) return seeded && !localSeed ? "deleted" : "create"
  // A doc seeded before offers began has no offer recorded; the hash it was saved with says
  // whether the repo has changed it since. One an editor wrote here has no hash, and gets only
  // later changes.
  if (!offered && (!sourceHash || sourceHash === hash)) return "baseline"
  return offered?.hash === hash ? "unchanged" : "suggest"
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

/**
 * Seeds this site's database with each doc in `dir` it has never had, as a draft, with its
 * files uploaded to Media, and lists the repo's changes to a doc it has as a suggestion beside
 * it (`planRepoDoc` decides which). Code never publishes, changes or deletes a doc the site has,
 * so editors own a doc from the moment it arrives and decide every word readers see. Each doc is
 * recorded as seeded (`markSeeded`), so one an editor deletes isn't seeded again; each revision
 * as offered (`markOffered`), so it's suggested once; and the repo's copy the site last took in
 * (`saveBaseline`), so the next change is a diff from it.
 */
export async function syncDocs(
  payload: Payload,
  dir = DOCS_DIR,
  { localSeed = false }: SyncOptions = {},
): Promise<SyncResult> {
  const result: SyncResult = {
    created: [],
    suggested: [],
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
      select: { slug: true, sourceHash: true, title: true },
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
    const copy: DocBaseline = {
      hash,
      source,
      files: Object.fromEntries(refs.map((ref, i) => [ref.$media, hashFile(files[i]!)])),
    }

    const offered = existing ? await lastOffered(payload, DOCS_SLUG, slug) : null
    const savedHash = offered ? offered.hash : (existing?.sourceHash ?? hash)
    const legacy =
      existing && savedHash !== hash && savedHash === legacyRepoDocHash(parent ?? "", source, files)
    const action = legacy
      ? "baseline"
      : planRepoDoc({
          exists: Boolean(existing),
          seeded,
          offered,
          sourceHash: existing?.sourceHash,
          hash,
          localSeed,
        })
    if (action === "deleted") {
      result.deleted.push(slug)
      continue
    }
    const baseline = existing ? await readBaseline(payload, slug) : null
    if (action === "baseline" || action === "unchanged") {
      if (action === "baseline") await markOffered(payload, DOCS_SLUG, slug, hash)
      // The repo's copy is the one the site has seen: kept, if the site has no copy of it yet
      // (a doc seeded before copies were kept), so the next change is a diff from it.
      if (baseline?.hash !== hash) await saveBaseline(payload, slug, copy)
      result.existing.push(slug)
      continue
    }

    if (action === "suggest") {
      const changed = new Set(changedFiles(baseline?.files, copy.files))
      const pictures: (number | string)[] = []
      for (const [i, ref] of refs.entries()) {
        if (changed.has(ref.$media)) {
          pictures.push(await uploadOnce(payload, ref.$media, files[i]!, ref))
        }
      }
      await suggestChange(payload, {
        doc: existing!.id,
        title: existing!.title,
        from: baseline,
        to: copy,
        pictures,
      })
      await markOffered(payload, DOCS_SLUG, slug, hash)
      await saveBaseline(payload, slug, copy)
      result.suggested.push(slug)
      continue
    }

    const mediaIds = new Map<string, number | string>()
    for (const [i, ref] of refs.entries()) {
      mediaIds.set(ref.$media, await uploadOnce(payload, ref.$media, files[i]!, ref))
    }

    // Converted only for a doc it creates: a deploy reads every doc.
    editorConfig ??= docsEditorConfig(payload.config)
    const { heroAlt, heroImage, changeNote: _changeNote, ...rest } = meta
    const repoDoc: RepoDoc = {
      ...rest,
      ...(heroImage ? { heroImage: { $media: heroImage, alt: heroAlt } } : {}),
      parent,
      content: markdownToContent(slug, body, editorConfig),
    }
    const publish = localSeed
    // Under its folder's doc; at the top when the site has none (an editor deleted it).
    const parentId = repoDoc.parent ? (ids.get(repoDoc.parent) ?? null) : null
    const { id } = await payload.create({
      collection: DOCS_SLUG,
      data: {
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
        _status: publish ? "published" : "draft",
        parent: parentId as number | null,
      },
      context,
      draft: !publish,
      overrideAccess: true,
    })
    ids.set(slug, id)
    await markSeeded(payload, DOCS_SLUG, slug)
    await markOffered(payload, DOCS_SLUG, slug, hash)
    await saveBaseline(payload, slug, copy)
    result.created.push(slug)
  }
  return result
}
