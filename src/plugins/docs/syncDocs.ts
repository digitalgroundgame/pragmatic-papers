import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import type { Doc } from "@/payload-types"
import type { Payload } from "payload"

import { DOCS_SLUG } from "./collection"
import { imagesIn, parseDocFile } from "./docFile"
import { docsEditorConfig, markdownToContent } from "./markdown"
import { hashRepoDoc, mediaFilename, mediaRefsIn, type RepoDoc, unpackMedia } from "./repoDoc"
import { DOC_SECTIONS, type DocSection } from "./sections"

/**
 * Where the repo keeps its docs: a folder per section, holding `<slug>.md` and the files it
 * shows. The build traces it into the image.
 */
export const DOCS_DIR = path.resolve(process.cwd(), "src/docs")

export interface DocFileEntry {
  slug: string
  section: DocSection
  /** The section's folder, where the doc's files are. */
  folder: string
  file: string
}

/** Every `<section>/<slug>.md` in `dir`, by slug. Throws on an unknown section or a slug used twice. */
export async function listDocFiles(dir = DOCS_DIR): Promise<DocFileEntry[]> {
  const sections = DOC_SECTIONS.map((section) => section.value as string)
  const found: DocFileEntry[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const folder = path.join(dir, entry.name)
    const files = (await readdir(folder)).filter((name) => name.endsWith(".md"))
    if (!files.length) continue
    if (!sections.includes(entry.name)) {
      throw new Error(`src/docs/${entry.name}/ isn't a section (known: ${sections.join(", ")})`)
    }
    for (const name of files) {
      const slug = name.slice(0, -".md".length)
      const twin = found.find((doc) => doc.slug === slug)
      if (twin)
        throw new Error(`Two docs are called "${slug}": in ${twin.section}/ and ${entry.name}/`)
      found.push({ slug, section: entry.name as DocSection, folder, file: path.join(folder, name) })
    }
  }
  return found.sort((a, b) => a.slug.localeCompare(b.slug))
}

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
 * Writes each doc in `dir` into this site's database, published, with its files uploaded to
 * Media. A doc whose file and pictures hash the same as last time is skipped, so a deploy with
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

  let editorConfig: ReturnType<typeof docsEditorConfig> | undefined
  for (const { slug, section, folder, file } of await listDocFiles(dir)) {
    const source = await readFile(file, "utf8")
    const { meta, body } = parseDocFile(source, path.relative(dir, file))
    const refs = mediaRefsIn([
      { $media: meta.heroImage, alt: meta.heroAlt },
      imagesIn(body).map((image) => ({ $media: image.file, alt: image.alt })),
    ])
    const files = await Promise.all(refs.map((ref) => readFile(path.join(folder, ref.$media))))
    const sourceHash = hashRepoDoc(section, source, files)

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
      ids.set(ref.$media, await uploadOnce(payload, ref.$media, files[i]!, ref))
    }

    // Converted only once it's known to have changed: a deploy reads every doc.
    editorConfig ??= docsEditorConfig(payload.config)
    const { heroAlt, heroImage, ...rest } = meta
    const repoDoc: RepoDoc = {
      ...rest,
      heroImage: { $media: heroImage, alt: heroAlt },
      section,
      content: markdownToContent(slug, body, editorConfig),
    }
    const data = {
      title: repoDoc.title,
      navTitle: repoDoc.navTitle ?? null,
      summary: repoDoc.summary,
      publishedAt: repoDoc.publishedAt,
      revisedAt: repoDoc.revisedAt ?? null,
      heroImage: unpackMedia(repoDoc.heroImage, ids) as number,
      section: repoDoc.section,
      audience: (repoDoc.audience ?? []) as Doc["audience"],
      showTableOfContents: repoDoc.showTableOfContents ?? true,
      tour: repoDoc.tour ?? null,
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
