import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Doc } from "@/payload-types"
import type { Payload } from "payload"

import { DOCS_SLUG } from "./collection"
import { imagesIn, parseDocFile } from "./docFile"
import { docsEditorConfig, markdownToContent } from "./markdown"
import { mediaFilename, mediaRefsIn, type RepoDoc, unpackMedia } from "./repoDoc"
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

export interface LoadResult {
  /** Docs created, published. */
  created: string[]
  /** Docs the database already has, left as they are. */
  existing: string[]
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
 * For the local seed (`pnpm dev:db-seed`), which has just wiped every doc: creates each doc in
 * `dir` the database doesn't have, published, with its files uploaded to Media, under the doc
 * its folder names. Deployed sites never run this: their docs are written by their editors in
 * the admin, and the Markdown in src/docs/ is reference for them.
 */
export async function loadRepoDocs(payload: Payload, dir = DOCS_DIR): Promise<LoadResult> {
  const result: LoadResult = { created: [], existing: [] }
  if (!existsSync(dir)) {
    payload.logger.warn(`No help docs to load: ${dir} doesn't exist here`)
    return result
  }

  const entries = await listDocFiles(dir)
  // Each doc by slug, so a doc is created under its folder's doc. Parents come first in
  // `entries`, so one created here is in it by the time its docs are.
  const ids = new Map<string, number | string>()
  const editorConfig = docsEditorConfig(payload.config)
  for (const { slug, parent, folder, file } of entries) {
    const { docs } = await payload.find({
      collection: DOCS_SLUG,
      depth: 0,
      draft: true,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      select: { slug: true },
      where: { slug: { equals: slug } },
    })
    if (docs[0]) {
      ids.set(slug, docs[0].id)
      result.existing.push(slug)
      continue
    }

    const source = await readFile(file, "utf8")
    const { meta, body } = parseDocFile(source, path.relative(dir, file))
    const refs = mediaRefsIn([
      meta.heroImage ? { $media: meta.heroImage, alt: meta.heroAlt } : [],
      imagesIn(body).map((image) => ({ $media: image.file, alt: image.alt })),
    ])
    const mediaIds = new Map<string, number | string>()
    for (const ref of refs) {
      const bytes = await readFile(path.join(folder, ref.$media))
      mediaIds.set(ref.$media, await uploadOnce(payload, ref.$media, bytes, ref))
    }

    const { heroAlt, heroImage, ...rest } = meta
    const repoDoc: RepoDoc = {
      ...rest,
      ...(heroImage ? { heroImage: { $media: heroImage, alt: heroAlt } } : {}),
      parent,
      content: markdownToContent(slug, body, editorConfig),
    }
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
        _status: "published",
        // Under its folder's doc; at the top when there's none.
        parent: (repoDoc.parent ? (ids.get(repoDoc.parent) ?? null) : null) as number | null,
      },
      context,
      overrideAccess: true,
    })
    ids.set(slug, id)
    result.created.push(slug)
  }
  return result
}
