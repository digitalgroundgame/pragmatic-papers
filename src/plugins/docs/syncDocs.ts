import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import type { Doc } from "@/payload-types"
import type { Payload } from "payload"

import { DOCS_SLUG } from "./collection"
import { hashRepoDoc, mediaFilename, mediaRefsIn, type RepoDoc, unpackMedia } from "./repoDoc"

/** Where the repo keeps its docs, one folder per slug. The build traces it into the image. */
export const DOCS_DIR = path.resolve(process.cwd(), "src/docs")

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
  created: string[]
  updated: string[]
  unchanged: string[]
}

const context = { disableRevalidate: true }

/** The Media id for a doc's file, uploading it the first time this content is seen. */
async function uploadOnce(
  payload: Payload,
  slug: string,
  file: string,
  bytes: Buffer,
  ref: { alt?: string | null; caption?: unknown },
): Promise<number | string> {
  const filename = mediaFilename(slug, file, bytes)
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
 * Writes each doc in `dir` into this site's database, published, with its files uploaded to
 * Media. A doc whose JSON and files hash the same as last time is skipped, so a deploy with
 * nothing new costs one query per doc. Docs that aren't in the repo are left alone, and so is
 * a repo doc edited in the admin, until the repo's copy changes.
 */
export async function syncDocs(payload: Payload, dir = DOCS_DIR): Promise<SyncResult> {
  const result: SyncResult = { created: [], updated: [], unchanged: [] }
  if (!existsSync(dir)) {
    // A deploy without the folder (a runtime with no file system for it) would otherwise
    // look like one with nothing to sync.
    payload.logger.warn(`No help docs to sync: ${dir} doesn't exist here`)
    return result
  }

  const entries = await readdir(dir, { withFileTypes: true })
  const slugs = entries
    .filter((entry) => entry.isDirectory() && existsSync(path.join(dir, entry.name, "doc.json")))
    .map((entry) => entry.name)
    .sort()

  for (const slug of slugs) {
    const folder = path.join(dir, slug)
    const json = await readFile(path.join(folder, "doc.json"), "utf8")
    const repoDoc = JSON.parse(json) as RepoDoc
    const refs = mediaRefsIn([repoDoc.heroImage, repoDoc.content])
    const files = await Promise.all(refs.map((ref) => readFile(path.join(folder, ref.$media))))
    const sourceHash = hashRepoDoc(json, files)

    const { docs } = await payload.find({
      collection: DOCS_SLUG,
      depth: 0,
      draft: true,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { slug: { equals: slug } },
    })
    const existing = docs[0]
    if (existing?.sourceHash === sourceHash) {
      result.unchanged.push(slug)
      continue
    }

    const ids = new Map<string, number | string>()
    for (const [i, ref] of refs.entries()) {
      ids.set(ref.$media, await uploadOnce(payload, slug, ref.$media, files[i]!, ref))
    }

    const data = {
      title: repoDoc.title,
      summary: repoDoc.summary,
      publishedAt: repoDoc.publishedAt,
      heroImage: unpackMedia(repoDoc.heroImage, ids) as number,
      section: repoDoc.section,
      audience: (repoDoc.audience ?? []) as Doc["audience"],
      showTableOfContents: repoDoc.showTableOfContents ?? true,
      content: unpackMedia(repoDoc.content, ids) as never,
      slug,
      sourceHash,
      _status: "published" as const,
    }
    if (existing) {
      await payload.update({
        collection: DOCS_SLUG,
        id: existing.id,
        data,
        context,
        overrideAccess: true,
      })
      result.updated.push(slug)
    } else {
      await payload.create({ collection: DOCS_SLUG, data, context, overrideAccess: true })
      result.created.push(slug)
    }
  }

  return result
}
