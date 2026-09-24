import { randomBytes } from "node:crypto"

import type { CollectionSlug, File, Payload, Where } from "payload"

import { createMediaFromURL } from "@/endpoints/seed/media"
import type { Role } from "@/access/roles"
import type { Article, MapAsset, Media, User, Volume } from "@/payload-types"

import {
  fetchProductionArticle,
  fetchProductionDoc,
  fetchProductionVolumeFor,
  productionUrl,
  type SourceDoc,
} from "./source"

/**
 * Articles linked from a cloned article are cloned too when they're missing
 * locally, this many links deep. Links past it point at production instead.
 */
const MAX_LINKED_ARTICLE_DEPTH = 1

/** Upload fields inside rich-text blocks, by field name. */
const BLOCK_UPLOAD_FIELDS: Record<string, CollectionSlug> = {
  media: "media",
  avatar: "media",
  svgAsset: "map-assets",
}

const MEDIA_SIZE_FALLBACKS = ["xlarge", "large", "og", "medium", "small"]

/** Roles each user relationship accepts (its `filterOptions`), and the one a clone is given. */
const AUTHOR_ROLES: Role[] = ["writer", "editor", "chief-editor", "narrator"]
const NARRATOR_ROLES: Role[] = ["narrator"]

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isDoc = (value: unknown): value is SourceDoc =>
  isObject(value) && typeof value.id === "number"

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

export class ArticleNotFoundError extends Error {}

export interface CloneResult {
  id: number
  slug: string
  title: string
  created: Partial<Record<CollectionSlug, number>>
}

/** The original file first, then its resized copies in case the original is gone. */
function mediaUrls(doc: SourceDoc): string[] {
  const sizes = isObject(doc.sizes) ? doc.sizes : {}
  const sizeUrl = (name: string) => {
    const size = sizes[name]
    return isObject(size) ? str(size.url) : undefined
  }
  const urls = [
    str(doc.url),
    ...MEDIA_SIZE_FALLBACKS.map(sizeUrl),
    ...Object.keys(sizes).map(sizeUrl),
  ]
  return [...new Set(urls.filter((url): url is string => Boolean(url)))]
}

async function firstReachable(urls: string[]): Promise<string | undefined> {
  for (const url of urls) {
    try {
      if ((await fetch(url, { method: "HEAD" })).ok) return url
    } catch {
      // Try the next size
    }
  }
  return undefined
}

class Cloner {
  readonly created: Partial<Record<CollectionSlug, number>> = {}
  private readonly resolved = new Map<string, number | null>()
  private readonly articlesInProgress = new Set<number>()
  private readonly clonedUsers = new Set<number>()
  /** Production block and row IDs to fresh ones, so a second clone can't collide with the first. */
  private readonly blockIds = new Map<string, string>()

  constructor(private readonly payload: Payload) {}

  async cloneArticle(
    source: SourceDoc,
    depth: number,
    { incrementSlug }: { incrementSlug: boolean },
  ): Promise<Article> {
    this.articlesInProgress.add(source.id)
    const meta = isObject(source.meta) ? source.meta : {}
    const title = str(source.title) ?? "Untitled"
    const baseSlug = str(source.slug) ?? "cloned-article"

    const article = await this.payload.create({
      collection: "articles",
      draft: false,
      data: {
        title,
        slug: incrementSlug ? await this.availableSlug("articles", baseSlug) : baseSlug,
        generateSlug: false,
        content: (await this.rewrite(source.content, depth)) as Article["content"],
        authors: await this.resolveUsers(source.authors, depth, AUTHOR_ROLES),
        topics: await this.resolveMany("topics", source.topics, depth),
        heroImage: await this.resolve("media", source.heroImage, depth),
        narration: await this.resolve("media", source.narration, depth),
        createdBy: await this.resolve("users", source.createdBy, depth),
        enableMathRendering: source.enableMathRendering === true,
        publishedAt: str(source.publishedAt) ?? new Date().toISOString(),
        _status: "published",
        meta: {
          title: str(meta.title),
          description: str(meta.description),
          image: await this.resolve("media", meta.image, depth),
        },
      },
    })
    this.resolved.set(`articles:${source.id}`, article.id)
    this.count("articles")

    await this.addToVolume(source.id, article.id, depth)
    return article
  }

  private async addToVolume(sourceArticleId: number, articleId: number, depth: number) {
    const sourceVolume = await fetchProductionVolumeFor(sourceArticleId)
    const volumeId = await this.resolve("volumes", sourceVolume, depth)
    if (!volumeId) return

    const volume = await this.payload.findByID({ collection: "volumes", id: volumeId, depth: 0 })
    const articleIds = (volume.articles ?? []).map((a) => (typeof a === "number" ? a : a.id))
    if (articleIds.includes(articleId)) return

    await this.payload.update({
      collection: "volumes",
      id: volumeId,
      data: { articles: [...articleIds, articleId] },
    })
  }

  private async resolveMany(collection: CollectionSlug, refs: unknown, depth: number) {
    const ids: number[] = []
    for (const ref of Array.isArray(refs) ? refs : []) {
      const id = await this.resolve(collection, ref, depth)
      if (id) ids.push(id)
    }
    return ids
  }

  /**
   * Local IDs for users, keeping only those the relationship's role filter
   * accepts. Users cloned in this run are given the first allowed role instead.
   */
  private async resolveUsers(refs: unknown, depth: number, allowed: Role[]): Promise<number[]> {
    const ids: number[] = []
    for (const ref of Array.isArray(refs) ? refs : [refs]) {
      const id = await this.resolve("users", ref, depth)
      if (!id) continue
      const user = await this.payload.findByID({ collection: "users", id, depth: 0 })
      const roles = (user.roles ?? []) as Role[]
      if (roles.some((role) => allowed.includes(role))) {
        ids.push(id)
      } else if (this.clonedUsers.has(id)) {
        await this.payload.update({
          collection: "users",
          id,
          data: { roles: [...roles, allowed[0]!] },
        })
        ids.push(id)
      }
    }
    return ids
  }

  /** Local ID for a production document, reusing or cloning it; null when neither works. */
  private async resolve(
    collection: CollectionSlug,
    ref: unknown,
    depth: number,
  ): Promise<number | null> {
    const sourceId = isDoc(ref) ? ref.id : typeof ref === "number" ? ref : undefined
    if (sourceId === undefined) return null

    const key = `${collection}:${sourceId}`
    if (this.resolved.has(key)) return this.resolved.get(key) ?? null

    let id: number | null = null
    try {
      const doc = isDoc(ref) ? ref : await fetchProductionDoc(collection, sourceId)
      if (doc) id = await this.reuseOrClone(collection, doc, depth)
    } catch (err) {
      this.payload.logger.warn({ err }, `[clone] Could not clone ${key} from production`)
    }
    this.resolved.set(key, id)
    return id
  }

  private async reuseOrClone(
    collection: CollectionSlug,
    doc: SourceDoc,
    depth: number,
  ): Promise<number | null> {
    const slug = str(doc.slug)
    const existing = slug ? await this.findLocal(collection, { slug: { equals: slug } }) : null
    if (existing) return existing

    switch (collection) {
      case "media":
        return this.cloneMedia(doc, depth)
      case "map-assets":
        return this.cloneMapAsset(doc, depth)
      case "users":
        return this.cloneUser(doc, depth)
      case "topics":
        return this.cloneTopic(doc, depth)
      case "volumes":
        return this.cloneVolume(doc, depth)
      case "articles":
        return this.cloneLinkedArticle(doc, depth)
      default:
        // Pages are site structure rather than content, so links to them point at production.
        return null
    }
  }

  private async cloneLinkedArticle(doc: SourceDoc, depth: number): Promise<number | null> {
    if (depth >= MAX_LINKED_ARTICLE_DEPTH || this.articlesInProgress.has(doc.id)) return null
    const source = str(doc.slug) ? await fetchProductionArticle(str(doc.slug)!) : null
    if (!source) return null
    const article = await this.cloneArticle(source, depth + 1, { incrementSlug: false })
    return article.id
  }

  private async cloneMedia(doc: SourceDoc, depth: number): Promise<number | null> {
    const url = await firstReachable(mediaUrls(doc))
    if (!url) return null

    const media = await createMediaFromURL(this.payload, url, str(doc.alt) ?? "", {
      caption: (await this.rewrite(doc.caption, depth)) as Media["caption"],
      narrator: (await this.resolveUsers(doc.narrator, depth, NARRATOR_ROLES))[0] ?? null,
      focalX: typeof doc.focalX === "number" ? doc.focalX : undefined,
      focalY: typeof doc.focalY === "number" ? doc.focalY : undefined,
    })
    this.count("media")
    return media.id
  }

  private async cloneMapAsset(doc: SourceDoc, depth: number): Promise<number | null> {
    const filename = str(doc.filename) ?? "map.svg"
    let data: Buffer
    if (str(doc.svgContent)) {
      data = Buffer.from(str(doc.svgContent)!)
    } else {
      const url = await firstReachable(mediaUrls(doc))
      if (!url) return null
      data = Buffer.from(await (await fetch(url)).arrayBuffer())
    }
    // Run-unique filename, as in the seeder, so Payload's filename-increment path never runs.
    const file: File = {
      name: `${Date.now()}-${filename}`,
      data,
      mimetype: str(doc.mimeType) ?? "image/svg+xml",
      size: data.byteLength,
    }

    const asset = await this.payload.create({
      collection: "map-assets",
      data: {
        label: str(doc.label),
        source: (await this.rewrite(doc.source, depth)) as MapAsset["source"],
      },
      file,
    })
    this.count("map-assets")
    return asset.id
  }

  private async cloneUser(doc: SourceDoc, depth: number): Promise<number | null> {
    const slug = str(doc.slug)
    if (!slug) return null

    const user = await this.payload.create({
      collection: "users",
      data: {
        name: str(doc.name) ?? slug,
        slug,
        generateSlug: false,
        affiliation: str(doc.affiliation),
        biography: (await this.rewrite(doc.biography, depth)) as User["biography"],
        profileImage: await this.resolve("media", doc.profileImage, depth),
        socials: (await this.rewrite(doc.socials, depth)) as User["socials"],
        roles: ["writer"],
        email: `${slug}@example.com`,
        // Nobody knows this password, so a cloned author can't be signed in as.
        password: randomBytes(32).toString("base64url"),
      },
    })
    this.count("users")
    this.clonedUsers.add(user.id)
    return user.id
  }

  private async cloneTopic(doc: SourceDoc, depth: number): Promise<number | null> {
    const name = str(doc.name)
    const slug = str(doc.slug)
    if (!name || !slug) return null
    // Topic names are unique too, and a local topic may share a name under another slug.
    const sameName = await this.findLocal("topics", { name: { equals: name } })
    if (sameName) return sameName

    const meta = isObject(doc.meta) ? doc.meta : {}
    const topic = await this.payload.create({
      collection: "topics",
      data: {
        name,
        slug,
        generateSlug: false,
        description: str(doc.description),
        meta: {
          title: str(meta.title),
          description: str(meta.description),
          image: await this.resolve("media", meta.image, depth),
        },
      },
    })
    this.count("topics")
    return topic.id
  }

  private async cloneVolume(doc: SourceDoc, depth: number): Promise<number | null> {
    const volumeNumber = typeof doc.volumeNumber === "number" ? doc.volumeNumber : undefined
    if (volumeNumber === undefined) return null
    const sameNumber = await this.findLocal("volumes", { volumeNumber: { equals: volumeNumber } })
    if (sameNumber) return sameNumber

    const meta = isObject(doc.meta) ? doc.meta : {}
    // Created without articles: only the cloned ones get added, by `addToVolume`.
    const volume = await this.payload.create({
      collection: "volumes",
      draft: false,
      data: {
        title: str(doc.title) ?? `Volume ${volumeNumber}`,
        volumeNumber,
        description: str(doc.description) ?? "",
        editorsNote: (await this.rewrite(doc.editorsNote, depth)) as Volume["editorsNote"],
        slug: str(doc.slug) ?? String(volumeNumber),
        generateSlug: false,
        publishedAt: str(doc.publishedAt) ?? new Date().toISOString(),
        _status: "published",
        articles: [],
        meta: {
          title: str(meta.title),
          description: str(meta.description),
          image: await this.resolve("media", meta.image, depth),
        },
      },
    })
    this.count("volumes")
    return volume.id
  }

  /**
   * Swaps every production reference in a rich-text or field value for a local
   * ID. Links whose target can't be brought over are pointed at production, and
   * any other unresolvable reference is dropped.
   */
  private async rewrite(value: unknown, depth: number): Promise<unknown> {
    if (Array.isArray(value)) {
      const items: unknown[] = []
      for (const item of value) {
        const next = await this.rewrite(item, depth)
        if (next !== undefined) items.push(next)
      }
      return items
    }
    if (!isObject(value)) return value

    const node: Json = { ...value }

    // Lexical internal link: { type: "link", fields: { linkType: "internal", doc: { relationTo, value } } }
    if (isObject(node.fields) && node.fields.linkType === "internal" && isObject(node.fields.doc)) {
      const { relationTo, value: target } = node.fields.doc
      const id = await this.resolve(relationTo as CollectionSlug, target, depth)
      node.fields = id
        ? { ...node.fields, doc: { relationTo, value: id } }
        : {
            ...node.fields,
            linkType: "custom",
            url: productionUrl(String(relationTo), target),
            doc: null,
          }
      if (Array.isArray(node.children)) node.children = await this.rewrite(node.children, depth)
      return node
    }

    // Link field group: { type: "reference", reference: { relationTo, value } }
    if (node.type === "reference" && isObject(node.reference)) {
      const { relationTo, value: target } = node.reference
      const id = await this.resolve(relationTo as CollectionSlug, target, depth)
      return id
        ? { ...node, reference: { relationTo, value: id } }
        : {
            ...node,
            type: "custom",
            url: productionUrl(String(relationTo), target),
            reference: null,
          }
    }

    // Any other polymorphic reference, e.g. Lexical upload and relationship nodes
    if (typeof node.relationTo === "string" && "value" in node) {
      const id = await this.resolve(node.relationTo as CollectionSlug, node.value, depth)
      if (!id) return undefined
      const rest = await this.rewriteEntries(node, depth, ["relationTo", "value"])
      return { ...rest, relationTo: node.relationTo, value: id }
    }

    return this.rewriteEntries(node, depth)
  }

  private async rewriteEntries(node: Json, depth: number, skip: string[] = []): Promise<Json> {
    const out: Json = {}
    for (const [key, child] of Object.entries(node)) {
      if (skip.includes(key)) continue
      const uploadCollection = BLOCK_UPLOAD_FIELDS[key]
      // Footnotes point at each other by `sourceId`, so both get the same new ID.
      if ((key === "id" || key === "sourceId") && typeof child === "string" && child) {
        out[key] = this.freshBlockId(child)
      } else if (uploadCollection && (isDoc(child) || typeof child === "number")) {
        out[key] = await this.resolve(uploadCollection, child, depth)
      } else {
        out[key] = await this.rewrite(child, depth)
      }
    }
    return out
  }

  private freshBlockId(sourceId: string): string {
    let id = this.blockIds.get(sourceId)
    if (!id) {
      id = randomBytes(12).toString("hex")
      this.blockIds.set(sourceId, id)
    }
    return id
  }

  private async findLocal(collection: CollectionSlug, where: Where): Promise<number | null> {
    const { docs } = await this.payload.find({
      collection,
      where,
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    return (docs[0]?.id as number | undefined) ?? null
  }

  /** `slug`, or the first of `slug-1`, `slug-2`, … that no document here uses yet. */
  private async availableSlug(collection: CollectionSlug, slug: string): Promise<string> {
    let candidate = slug
    for (let n = 1; await this.findLocal(collection, { slug: { equals: candidate } }); n++) {
      candidate = `${slug}-${n}`
    }
    return candidate
  }

  private count(collection: CollectionSlug) {
    this.created[collection] = (this.created[collection] ?? 0) + 1
  }
}

/**
 * Copies a published production article into this environment, along with
 * everything it references: authors, topics, media, map assets, its volume,
 * and linked articles. Referenced documents that already exist here (matched
 * by slug) are reused; the article itself always becomes a new document, with
 * its slug incremented when the original is taken.
 */
export async function cloneArticleFromProduction(
  payload: Payload,
  slug: string,
): Promise<CloneResult> {
  const source = await fetchProductionArticle(slug)
  if (!source) throw new ArticleNotFoundError(`No published article "${slug}" on production`)

  const cloner = new Cloner(payload)
  const article = await cloner.cloneArticle(source, 0, { incrementSlug: true })
  return { id: article.id, slug: article.slug, title: article.title, created: cloner.created }
}
