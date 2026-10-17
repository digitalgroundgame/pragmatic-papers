import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
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
import { DOC_SECTIONS_SLUG } from "./docSections"
import { HOME_DOC_SLUG } from "./sections"

/**
 * Where the repo keeps its docs: a folder per section, holding `<slug>.md` and the files it
 * shows, the home doc, `home.md`, and the starter sections, `sections.json`, at the top. The
 * build traces it into the image.
 */
export const DOCS_DIR = path.resolve(process.cwd(), "src/docs")

/**
 * The areas and sections a site starts with, in the sidebar's order: `src/docs/sections.json`.
 * A section's slug is its folder. Once a deploy has seeded them they're the site's, in Help →
 * Sections.
 */
export interface StarterSections {
  areas: {
    slug: string
    title: string
    sections: { slug: string; title: string }[]
  }[]
}

export const STARTER_SECTIONS_FILE = "sections.json"

/** Reads `sections.json` in `dir`. Throws on a slug used twice. */
export async function readStarterSections(dir = DOCS_DIR): Promise<StarterSections> {
  const starter = JSON.parse(
    await readFile(path.join(dir, STARTER_SECTIONS_FILE), "utf8"),
  ) as StarterSections
  const slugs = starter.areas.flatMap((area) => [
    area.slug,
    ...area.sections.map((section) => section.slug),
  ])
  const twice = slugs.find((slug, i) => slugs.indexOf(slug) !== i)
  if (twice) throw new Error(`src/docs/${STARTER_SECTIONS_FILE} uses "${twice}" twice`)
  return starter
}

export interface DocFileEntry {
  slug: string
  /** The slug of the section the doc's folder is for; null for the home doc. */
  section: string | null
  /** The section's folder, where the doc's files are. */
  folder: string
  file: string
}

/**
 * Every `<section>/<slug>.md` in `dir`, and `home.md`, by slug. Throws on a folder that isn't a
 * section in `sections.json`, a slug used twice, or another Markdown file outside a section.
 */
export async function listDocFiles(dir = DOCS_DIR): Promise<DocFileEntry[]> {
  const sections = (await readStarterSections(dir)).areas.flatMap((area) =>
    area.sections.map((section) => section.slug),
  )
  const found: DocFileEntry[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      if (entry.name !== `${HOME_DOC_SLUG}.md`) {
        throw new Error(`src/docs/${entry.name} should be in a section's folder`)
      }
      // In no section: the sidebar links it on its own, as Home.
      const file = path.join(dir, entry.name)
      found.push({ slug: HOME_DOC_SLUG, section: null, folder: dir, file })
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
      found.push({ slug, section: entry.name, folder, file: path.join(folder, name) })
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
  /** Starter areas and sections new to this site, created in Help → Sections. */
  sections: string[]
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

/**
 * Seeds the site's Sections with each starter area and section it has never had, in
 * `sections.json`'s order, which an editor can then change: rename, reorder, move or delete.
 * One an editor deleted stays deleted, and so do the sections of an area they deleted. Returns
 * the id of every section the site has, by slug, so each repo doc lands in its folder's.
 */
export async function syncDocSections(
  payload: Payload,
  starter: StarterSections,
  { localSeed = false, created = [] }: { localSeed?: boolean; created?: string[] } = {},
): Promise<Map<string, number>> {
  const { docs: existing } = await payload.find({
    collection: DOC_SECTIONS_SLUG,
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    select: { slug: true },
  })
  const ids = new Map<string, number>(
    existing.flatMap((doc) => (doc.slug ? [[doc.slug, doc.id] as const] : [])),
  )

  const seedOnce = async (
    slug: string,
    data: { title: string; parent?: number },
  ): Promise<void> => {
    const seeded = await wasSeeded(payload, DOC_SECTIONS_SLUG, slug)
    if (ids.has(slug)) {
      if (!seeded) await markSeeded(payload, DOC_SECTIONS_SLUG, slug)
      return
    }
    if (seeded && !localSeed) return
    const doc = await payload.create({
      collection: DOC_SECTIONS_SLUG,
      // Sections have no drafts: an empty one stays out of the sidebar until a doc is in it.
      data: { ...data, slug },
      context,
      overrideAccess: true,
    })
    ids.set(slug, doc.id)
    await markSeeded(payload, DOC_SECTIONS_SLUG, slug)
    created.push(slug)
  }

  for (const area of starter.areas) {
    await seedOnce(area.slug, { title: area.title })
    const parent = ids.get(area.slug)
    if (parent === undefined) continue
    for (const section of area.sections) {
      await seedOnce(section.slug, { title: section.title, parent })
    }
  }
  return ids
}

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
    sections: [],
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
  const sectionIds = await syncDocSections(payload, await readStarterSections(dir), {
    localSeed,
    created: result.sections,
  })
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
      select: { slug: true, sourceHash: true },
      where: { slug: { equals: slug } },
    })
    const existing = docs[0]
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
    const hash = hashRepoDoc(section ?? "", source, files)

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

    const ids = new Map<string, number | string>()
    for (const [i, ref] of refs.entries()) {
      ids.set(ref.$media, await uploadOnce(payload, ref.$media, files[i]!, ref))
    }

    // Converted only for a doc it creates or offers: a deploy reads every doc.
    editorConfig ??= docsEditorConfig(payload.config)
    const { heroAlt, heroImage, ...rest } = meta
    const repoDoc: RepoDoc = {
      ...rest,
      ...(heroImage ? { heroImage: { $media: heroImage, alt: heroAlt } } : {}),
      section,
      content: markdownToContent(slug, body, editorConfig),
    }
    const publish = localSeed && action === "create"
    const data = {
      title: repoDoc.title,
      navTitle: repoDoc.navTitle ?? null,
      summary: repoDoc.summary,
      publishedAt: repoDoc.publishedAt,
      revisedAt: repoDoc.revisedAt ?? null,
      heroImage: repoDoc.heroImage ? (unpackMedia(repoDoc.heroImage, ids) as number) : null,
      // A section an editor deleted, or renamed, leaves the doc under Other until they file it.
      section: repoDoc.section ? (sectionIds.get(repoDoc.section) ?? null) : null,
      audience: (repoDoc.audience ?? []) as Doc["audience"],
      showTableOfContents: repoDoc.showTableOfContents ?? true,
      tour: repoDoc.tour ?? null,
      content: unpackMedia(repoDoc.content, ids) as never,
      slug,
      sourceHash: hash,
      _status: publish ? ("published" as const) : ("draft" as const),
    }

    let id: number | string
    if (action === "offer") {
      // Saved as a draft, it's a new version only: the published doc stays as it is, and the
      // admin shows the doc as Changed, with the suggestion to compare in its Versions tab.
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
      id = (
        await payload.create({
          collection: DOCS_SLUG,
          data,
          context,
          draft: !publish,
          overrideAccess: true,
        })
      ).id
      await markSeeded(payload, DOCS_SLUG, slug)
      result.created.push(slug)
    }
    // The version just saved, so the next deploy knows a latest draft with this id is its own.
    await markOffered(payload, DOCS_SLUG, slug, hash, (await latestVersion(payload, id))?.id)
  }
  return result
}
