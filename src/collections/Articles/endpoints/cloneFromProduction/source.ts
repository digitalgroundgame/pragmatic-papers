import type { CollectionSlug } from "payload"

export const PRODUCTION_URL = "https://pragmaticpapers.com"

/** A populated document as production's REST API returns it. */
export type SourceDoc = Record<string, unknown> & { id: number }

export interface ProductionArticleSummary {
  id: number
  title: string
  slug: string
  publishedAt?: string | null
}

type Query = Record<string, string | number>

async function fetchProduction<T>(path: string, query: Query = {}): Promise<T> {
  const url = new URL(`/api/${path}`, PRODUCTION_URL)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))

  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`Production API returned ${res.status} for ${url.pathname}`)
  return (await res.json()) as T
}

async function findOne(collection: CollectionSlug, query: Query): Promise<SourceDoc | null> {
  const { docs } = await fetchProduction<{ docs: SourceDoc[] }>(collection, { ...query, limit: 1 })
  return docs[0] ?? null
}

/** Latest published articles on production, filtered by title when `search` is given. */
export async function searchProductionArticles(
  search: string,
  limit = 20,
): Promise<ProductionArticleSummary[]> {
  const query: Query = {
    depth: 0,
    limit,
    sort: "-publishedAt",
    "select[title]": "true",
    "select[slug]": "true",
    "select[publishedAt]": "true",
  }
  if (search.trim()) query["where[title][like]"] = search.trim()

  const { docs } = await fetchProduction<{ docs: ProductionArticleSummary[] }>("articles", query)
  return docs
}

export function fetchProductionArticle(slug: string): Promise<SourceDoc | null> {
  return findOne("articles", { "where[slug][equals]": slug, depth: 2 })
}

/** The volume an article was published in, found through the volume's `articles` list. */
export function fetchProductionVolumeFor(articleId: number): Promise<SourceDoc | null> {
  return findOne("volumes", { "where[articles][contains]": articleId, depth: 1 })
}

export async function fetchProductionDoc(
  collection: CollectionSlug,
  id: number,
): Promise<SourceDoc | null> {
  try {
    return await fetchProduction<SourceDoc>(`${collection}/${id}`, { depth: 1 })
  } catch {
    return null
  }
}

const frontendPaths: Partial<Record<CollectionSlug, string>> = {
  articles: "/articles/",
  volumes: "/volumes/",
  topics: "/topics/",
  users: "/authors/",
  pages: "/",
}

/** Where a document lives on production, for links that can't be pointed at a local copy. */
export function productionUrl(collection: string, doc: unknown): string {
  const prefix = frontendPaths[collection as CollectionSlug]
  const slug =
    typeof doc === "object" && doc !== null && "slug" in doc && typeof doc.slug === "string"
      ? doc.slug
      : undefined
  if (!prefix || !slug) return PRODUCTION_URL
  return `${PRODUCTION_URL}${prefix}${slug === "home" && collection === "pages" ? "" : slug}`
}
