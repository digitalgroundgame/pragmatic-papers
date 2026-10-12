import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import type { Doc } from "@/payload-types"
import { markSeeded, wasSeeded } from "@/utilities/seedOnce"
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
  /** Docs new to this site, created as drafts for an editor to publish. */
  created: string[]
  /** Docs the site already has, left as they are: once seeded, a doc is the site's. */
  existing: string[]
  /** Docs seeded here before and deleted since, which stay deleted. */
  deleted: string[]
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
 * files uploaded to Media. Push only: a doc the site already has (by slug, draft or published,
 * seeded or written in the admin) is never overwritten, and nothing is ever deleted, so editors
 * own a doc from the moment it arrives. Each doc is recorded as seeded (`markSeeded`), so one an
 * editor deletes isn't seeded again.
 */
export async function syncDocs(
  payload: Payload,
  dir = DOCS_DIR,
  { localSeed = false }: SyncOptions = {},
): Promise<SyncResult> {
  const result: SyncResult = { created: [], existing: [], deleted: [] }
  if (!existsSync(dir)) {
    // A deploy without the folder (a runtime with no file system for it) would otherwise
    // look like one with nothing to sync.
    payload.logger.warn(`No help docs to sync: ${dir} doesn't exist here`)
    return result
  }

  const entries = await listDocFiles(dir)
  let editorConfig: ReturnType<typeof docsEditorConfig> | undefined
  for (const { slug, section, folder, file } of entries) {
    const seeded = await wasSeeded(payload, DOCS_SLUG, slug)
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
    if (docs.length) {
      // Recorded too, so a doc the site had before seeding was recorded stays deleted once an
      // editor deletes it.
      if (!seeded) await markSeeded(payload, DOCS_SLUG, slug)
      result.existing.push(slug)
      continue
    }
    if (seeded && !localSeed) {
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

    const ids = new Map<string, number | string>()
    for (const [i, ref] of refs.entries()) {
      ids.set(ref.$media, await uploadOnce(payload, ref.$media, files[i]!, ref))
    }

    // Converted only for a doc it creates: a deploy reads every doc.
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
      sourceHash: hashRepoDoc(section, source, files),
      _status: localSeed ? ("published" as const) : ("draft" as const),
    }
    await payload.create({
      collection: DOCS_SLUG,
      data,
      context,
      draft: !localSeed,
      overrideAccess: true,
    })
    await markSeeded(payload, DOCS_SLUG, slug)
    result.created.push(slug)
  }
  return result
}
