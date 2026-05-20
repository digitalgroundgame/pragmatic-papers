import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import type { Article, Media } from "@/payload-types"
import type { FeedArticle, FeedBatch, FeedNextArticle } from "./types"

const PAGE_SIZE = 8

// Mulberry32 PRNG so server-side shuffles are deterministic per seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = items[i] as T
    items[i] = items[j] as T
    items[j] = tmp
  }
  return items
}

// Bucket-by-week, weight recent buckets higher, shuffle within. Pluggable: swap
// this body for a different ranking strategy without touching call sites.
export function rankFeed<T extends { publishedAt?: string | null }>(items: T[], seed: number): T[] {
  if (items.length <= 1) return items
  const rand = mulberry32(seed)

  const now = Date.now()
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const buckets = new Map<number, T[]>()
  for (const item of items) {
    const t = item.publishedAt ? new Date(item.publishedAt).getTime() : now - 365 * WEEK
    const bucket = Math.floor((now - t) / WEEK)
    if (!buckets.has(bucket)) buckets.set(bucket, [])
    buckets.get(bucket)!.push(item)
  }

  const orderedBuckets = [...buckets.keys()].sort((a, b) => a - b)
  const out: T[] = []
  for (const key of orderedBuckets) {
    const bucketItems = buckets.get(key)!
    shuffleInPlace(bucketItems, rand)
    out.push(...bucketItems)
  }
  return out
}

function pickHeroImageUrl(image: number | Media | null | undefined): string | null {
  if (!image || typeof image === "number") return null
  return image.sizes?.square?.url ?? image.sizes?.thumbnail?.url ?? image.url ?? null
}

function toFeedNextArticle(doc: Article): FeedNextArticle {
  const authorName =
    (doc.populatedAuthors ?? [])
      .map((a) => (typeof a === "object" ? a.name : null))
      .find(Boolean) ?? null
  return {
    slug: doc.slug ?? "",
    title: doc.title ?? "",
    heroImageUrl: pickHeroImageUrl(doc.heroImage),
    authorName,
  }
}

export async function resolveNextArticle(
  current: FeedArticle,
  cache: Map<string, FeedNextArticle | null> = new Map(),
): Promise<FeedNextArticle | null> {
  const payload = await getPayloadConfig()
  const primaryAuthor = (current.populatedAuthors ?? []).find(
    (a) => typeof a === "object" && typeof a.id === "number",
  )
  const authorId = primaryAuthor && typeof primaryAuthor === "object" ? primaryAuthor.id : undefined

  if (authorId !== undefined) {
    const key = `author:${authorId}:not:${current.slug ?? ""}`
    if (cache.has(key)) return cache.get(key) ?? null
    const res = await payload.find({
      collection: "articles",
      draft: false,
      overrideAccess: false,
      where: {
        and: [
          { _status: { equals: "published" } },
          { authors: { equals: authorId } },
          { slug: { not_equals: current.slug ?? "" } },
        ],
      },
      sort: "-publishedAt",
      limit: 1,
      depth: 1,
    })
    const doc = res.docs[0] as Article | undefined
    if (doc) {
      const out = toFeedNextArticle(doc)
      cache.set(key, out)
      return out
    }
    cache.set(key, null)
  }

  const fallbackKey = `fallback:not:${current.slug ?? ""}`
  if (cache.has(fallbackKey)) return cache.get(fallbackKey) ?? null
  const fallback = await payload.find({
    collection: "articles",
    draft: false,
    overrideAccess: false,
    where: {
      and: [{ _status: { equals: "published" } }, { slug: { not_equals: current.slug ?? "" } }],
    },
    sort: "-publishedAt",
    limit: 1,
    depth: 1,
  })
  const doc = fallback.docs[0] as Article | undefined
  const out = doc ? toFeedNextArticle(doc) : null
  cache.set(fallbackKey, out)
  return out
}

export async function getFeedBatch({
  cursor,
  limit = PAGE_SIZE,
  seed,
}: {
  cursor: number | null
  limit?: number
  seed?: number
}): Promise<FeedBatch> {
  const payload = await getPayloadConfig()
  const page = cursor ?? 1
  const res = await payload.find({
    collection: "articles",
    draft: false,
    overrideAccess: false,
    where: { _status: { equals: "published" } },
    sort: "-publishedAt",
    limit,
    page,
    depth: 2,
  })

  const ranked = rankFeed(res.docs as FeedArticle[], seed ?? page * 9973)

  const nextCache = new Map<string, FeedNextArticle | null>()
  const withNext = await Promise.all(
    ranked.map(async (article) => ({
      ...article,
      nextArticle: await resolveNextArticle(article, nextCache),
    })),
  )

  return {
    items: withNext,
    nextCursor: res.hasNextPage ? page + 1 : null,
  }
}
