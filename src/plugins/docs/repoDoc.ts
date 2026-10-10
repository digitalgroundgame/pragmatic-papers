import { createHash } from "node:crypto"

import type { Role } from "@/access/roles"

import type { DocSection } from "./sections"

/**
 * A doc as it's kept in the repo, at `src/docs/<slug>/doc.json`, beside the files it shows.
 * Media ids differ from site to site, so wherever the doc uses media the JSON holds a
 * `MediaRef` naming a file in the same folder; `syncDocs` uploads it and puts the id back.
 */
export interface RepoDoc {
  title: string
  summary: string
  /** `YYYY-MM-DD`. */
  publishedAt: string
  /** `YYYY-MM-DD`: when it last changed in a way readers should know about, shown beside its date. */
  revisedAt?: string
  /** A file in the doc's folder: the bell's thumbnail and the link preview's image. */
  heroImage: MediaRef
  /** Where it sits in the sidebar at /docs. */
  section: DocSection
  audience?: Role[]
  /** Left out means shown. */
  showTableOfContents?: boolean
  content: unknown
}

export interface MediaRef {
  /** A file in the doc's folder. */
  $media: string
  alt?: string | null
  caption?: unknown
}

export const isMediaRef = (value: unknown): value is MediaRef =>
  Boolean(value) && typeof (value as MediaRef).$media === "string"

/** A populated Media document, as an export at depth finds it inside rich text. */
interface MediaDoc {
  id: number | string
  filename: string
  mimeType: string
  alt?: string | null
  caption?: unknown
}

const isMediaDoc = (value: unknown): value is MediaDoc => {
  const v = value as Partial<MediaDoc> | null
  return (
    Boolean(v) &&
    typeof v === "object" &&
    v?.id != null &&
    typeof v.filename === "string" &&
    typeof v.mimeType === "string"
  )
}

/** Copies `value`, replacing each node `replace` returns something for. */
const mapTree = (value: unknown, replace: (node: unknown) => unknown): unknown => {
  const replaced = replace(value)
  if (replaced !== undefined) return replaced
  if (Array.isArray(value)) return value.map((item) => mapTree(item, replace))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapTree(item, replace)]),
    )
  }
  return value
}

/** The name a synced file is uploaded under, so the next sync finds it instead of uploading again. */
export const mediaFilename = (slug: string, file: string, bytes: Buffer): string =>
  `docs-${slug}-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}-${file}`

/** A synced file's name in the repo: its Media filename without what `mediaFilename` added. */
export const repoFilename = (slug: string, filename: string): string =>
  filename.replace(new RegExp(`^docs-${slug}-[0-9a-f]{8}-`), "")

/**
 * For an export: swaps each populated Media document in `content` for a `MediaRef`, and
 * returns the documents so their files can be copied beside the JSON.
 */
export const packMedia = (
  slug: string,
  content: unknown,
): { content: unknown; media: Map<string, MediaDoc> } => {
  const media = new Map<string, MediaDoc>()
  const packed = mapTree(content, (node) => {
    if (!isMediaDoc(node)) return undefined
    const file = repoFilename(slug, node.filename)
    media.set(file, node)
    const ref: MediaRef = { $media: file, alt: node.alt ?? null }
    if (node.caption) ref.caption = node.caption
    return ref
  })
  return { content: packed, media }
}

/** Every `MediaRef` in `content`, once per file. */
export const mediaRefsIn = (content: unknown): MediaRef[] => {
  const refs = new Map<string, MediaRef>()
  mapTree(content, (node) => {
    if (!isMediaRef(node)) return undefined
    if (!refs.has(node.$media)) refs.set(node.$media, node)
    return node
  })
  return [...refs.values()]
}

/** For a sync: swaps each `MediaRef` for the id of the Media its file was uploaded as. */
export const unpackMedia = (content: unknown, ids: Map<string, number | string>): unknown =>
  mapTree(content, (node) => {
    if (!isMediaRef(node)) return undefined
    const id = ids.get(node.$media)
    if (id === undefined) throw new Error(`No media uploaded for ${node.$media}`)
    return id
  })

/** Changes when the JSON or any file it uses does, so an unchanged doc is skipped. */
export const hashRepoDoc = (json: string, files: Buffer[]): string => {
  const hash = createHash("sha256").update(json)
  for (const file of files) hash.update(file)
  return hash.digest("hex")
}
