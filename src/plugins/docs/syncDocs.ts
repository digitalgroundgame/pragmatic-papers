import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import type { Doc } from "@/payload-types"
import type { Payload } from "payload"

import { DOCS_SLUG } from "./collection"
import { imagesIn, parseDocFile } from "./docFile"
import { docsEditorConfig, markdownToContent } from "./markdown"
import { hashRepoDoc, mediaFilename, mediaRefsIn, type RepoDoc, unpackMedia } from "./repoDoc"
import { DEFAULT_DOC_SECTION, DOC_SECTIONS, type DocSection, HOME_DOC_SLUG } from "./sections"

/**
 * Where the repo keeps its docs: a folder per section, holding `<slug>.md` and the files it
 * shows, and the home doc, `home.md`, at the top. The build traces it into the image.
 */
export const DOCS_DIR = path.resolve(process.cwd(), "src/docs")

export interface DocFileEntry {
  slug: string
  section: DocSection
  /** The section's folder, where the doc's files are. */
  folder: string
  file: string
}

/**
 * Every `<section>/<slug>.md` in `dir`, and `home.md`, by slug. Throws on an unknown section, a
 * slug used twice, or another Markdown file outside a section.
 */
export async function listDocFiles(dir = DOCS_DIR): Promise<DocFileEntry[]> {
  const sections = DOC_SECTIONS.map((section) => section.value as string)
  const found: DocFileEntry[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      if (entry.name !== `${HOME_DOC_SLUG}.md`) {
        throw new Error(`src/docs/${entry.name} should be in a section's folder`)
      }
      // Kept in the default section, which the sidebar leaves it out of.
      const file = path.join(dir, entry.name)
      found.push({ slug: HOME_DOC_SLUG, section: DEFAULT_DOC_SECTION, folder: dir, file })
      continue
    }
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
  /** Repo docs whose file is gone from the repo, deleted from this site. */
  deleted: string[]
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

/** Deletes the repo docs (those with a `sourceHash`) whose slug no longer has a file. */
async function deleteRemovedDocs(payload: Payload, entries: DocFileEntry[]): Promise<string[]> {
  const { docs } = await payload.find({
    collection: DOCS_SLUG,
    depth: 0,
    draft: true,
    overrideAccess: true,
    pagination: false,
    select: { slug: true },
    where: {
      and: [
        { sourceHash: { exists: true } },
        { slug: { not_in: entries.map((entry) => entry.slug) } },
      ],
    },
  })
  const deleted: string[] = []
  for (const doc of docs) {
    await payload.delete({ collection: DOCS_SLUG, id: doc.id, context, overrideAccess: true })
    deleted.push(doc.slug)
  }
  return deleted
}

/**
 * Writes each doc in `dir` into this site's database, published, with its files uploaded to
 * Media. A doc whose file and pictures hash the same as last time is skipped, so a deploy with
 * nothing new costs one query per doc. A repo doc edited in the admin is left alone until the
 * repo's copy changes. A doc the repo synced before whose file has since been removed or renamed
 * is deleted; docs written in the admin are never touched.
 */
export async function syncDocs(payload: Payload, dir = DOCS_DIR): Promise<SyncResult> {
  const result: SyncResult = { created: [], updated: [], unchanged: [], deleted: [] }
  if (!existsSync(dir)) {
    // A deploy without the folder (a runtime with no file system for it) would otherwise
    // look like one with nothing to sync.
    payload.logger.warn(`No help docs to sync: ${dir} doesn't exist here`)
    return result
  }

  const entries = await listDocFiles(dir)
  let editorConfig: ReturnType<typeof docsEditorConfig> | undefined
  for (const { slug, section, folder, file } of entries) {
    const source = await readFile(file, "utf8")
    const { meta, body } = parseDocFile(source, path.relative(dir, file))
    const refs = mediaRefsIn([
      meta.heroImage ? { $media: meta.heroImage, alt: meta.heroAlt } : [],
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
      ...(heroImage ? { heroImage: { $media: heroImage, alt: heroAlt } } : {}),
      section,
      content: markdownToContent(slug, body, editorConfig),
    }
    const data = {
      title: repoDoc.title,
      navTitle: repoDoc.navTitle ?? null,
      summary: repoDoc.summary,
      publishedAt: repoDoc.publishedAt,
      revisedAt: repoDoc.revisedAt ?? null,
      heroImage: repoDoc.heroImage ? (unpackMedia(repoDoc.heroImage, ids) as number) : null,
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

  // An empty folder is more likely a broken build than a repo with no docs left.
  if (entries.length) result.deleted = await deleteRemovedDocs(payload, entries)
  return result
}
