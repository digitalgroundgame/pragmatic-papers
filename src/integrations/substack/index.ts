import { env, type Integration } from "../types"

/**
 * What a feed item is, from its enclosure: a podcast episode carries audio, a video post
 * video, and anything else (a written post, whose enclosure is its cover image if any) is a
 * post. The feed says nothing else about where a post came from, so articles we syndicate to
 * Substack are posts.
 */
export type SubstackPostType = "podcast" | "video" | "post"

export const SUBSTACK_POST_TYPES: readonly SubstackPostType[] = ["podcast", "video", "post"]

/** One of the publication's posts. */
export interface SubstackPost {
  /** The feed's `guid`, stable across reads; the post's link when the feed gives none. */
  id: string
  title: string
  /** The post's subtitle, when it has one. */
  subtitle: string
  /** The post on the publication's site. */
  url: string
  /** When it was published (ISO 8601). */
  createdAt: string
  type: SubstackPostType
}

export interface SubstackPublicationsIntegration extends Integration {
  /**
   * The publications to read, each as the host its feed is on: `publications` when it has any
   * (the admin's list), else the publications variable, else the default.
   */
  publications(publications?: readonly string[] | null): string[]
  /** The post types to read: `types` when it has any (the admin's choice), else the default. */
  types(types?: readonly string[] | null): SubstackPostType[]
  /**
   * One publication's newest posts of `types` (all of them when left out), newest first, from
   * its RSS feed. Throws when Substack refuses the request.
   */
  recentPosts(opts: {
    publication: string
    types?: readonly SubstackPostType[]
    limit?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<SubstackPost[]>
}

export interface SubstackPublicationsOptions {
  id: string
  label: string
  defaultPublications: readonly string[]
  /** The post types read when the admin picks none. */
  defaultTypes: readonly SubstackPostType[]
  /** Environment variable holding publications, comma separated, for when the admin lists none. */
  publicationsEnv: string
}

/**
 * The host a publication's feed is on, however it was written: `name`, `@name`,
 * `name.substack.com`, its profile `substack.com/@name`, a custom domain, or any of those as a
 * URL. A profile's handle is taken as the publication's subdomain, which it is unless the
 * publication was renamed. Empty when nothing usable is left.
 */
export function publicationHost(publication: string): string {
  let value = publication.trim()
  if (!value) return ""
  if (!/^https?:\/\//i.test(value)) value = `https://${value.replace(/^@/, "")}`
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return ""
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  if (host === "substack.com") {
    const [, handle] = url.pathname.match(/^\/@([\w-]+)/) ?? []
    return handle ? `${handle.toLowerCase()}.substack.com` : ""
  }
  // A bare name is a Substack subdomain; anything with a dot is a host of its own.
  return host.includes(".") ? host : `${host}.substack.com`
}

const list = (publications: readonly string[]): string[] => [
  ...new Set(publications.map(publicationHost).filter(Boolean)),
]

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

/** Text as the feed holds it, without CDATA, tags or entities, on one line. */
function plain(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name: string) => {
      if (name[0] === "#") {
        const code =
          name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1))
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : entity
      }
      return ENTITIES[name.toLowerCase()] ?? entity
    })
    .replace(/\s+/g, " ")
    .trim()
}

/** The text of an item's first `<tag>`, or "". */
function element(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? plain(match[1]!) : ""
}

/** Whether `url` is a web link: the ticker renders it as an `href`. */
function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

/** What an item is, from its enclosure's MIME type (`SubstackPostType`). */
function itemType(item: string): SubstackPostType {
  const [, mime = ""] = item.match(/<enclosure\b[^>]*\btype=["']([^"']+)["']/i) ?? []
  if (/^audio\//i.test(mime)) return "podcast"
  if (/^video\//i.test(mime)) return "video"
  return "post"
}

/** The posts in an RSS feed, in the feed's order. Items without a title, link or date are skipped. */
export function parseFeed(xml: string): SubstackPost[] {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].flatMap(([, item]) => {
    const title = element(item!, "title")
    const url = element(item!, "link")
    const published = Date.parse(element(item!, "pubDate"))
    if (!title || !isWebUrl(url) || Number.isNaN(published)) return []
    return [
      {
        id: element(item!, "guid") || url,
        title,
        subtitle: element(item!, "description"),
        url,
        createdAt: new Date(published).toISOString(),
        type: itemType(item!),
      },
    ]
  })
}

/**
 * A connection to our Substack publications, for reading their posts from each one's public
 * RSS feed (`<host>/feed`). It needs no credentials, so it is always configured.
 */
export function substackPublications({
  id,
  label,
  defaultPublications,
  defaultTypes,
  publicationsEnv,
}: SubstackPublicationsOptions): SubstackPublicationsIntegration {
  const publications = (chosen?: readonly string[] | null): string[] => {
    for (const candidate of [
      chosen ?? [],
      (env(publicationsEnv) ?? "").split(","),
      defaultPublications,
    ]) {
      const found = list(candidate)
      if (found.length > 0) return found
    }
    return []
  }
  return {
    id,
    label,
    service: "Substack",
    describe: () =>
      publications()
        .map((host) => `substack:${host}`)
        .join(", "),
    required: [],
    optional: [publicationsEnv],
    publications,
    types(chosen) {
      const picked = SUBSTACK_POST_TYPES.filter((type) => chosen?.includes(type))
      return picked.length > 0 ? picked : [...defaultTypes]
    },
    async recentPosts({
      publication,
      types = SUBSTACK_POST_TYPES,
      limit = 5,
      fetchImpl = fetch,
      signal,
    }) {
      const host = publicationHost(publication)
      if (!host) throw new Error(`"${publication}" isn't a Substack publication`)
      const response = await fetchImpl(`https://${host}/feed`, {
        signal,
        headers: { Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
      })
      if (!response.ok) {
        throw new Error(`Substack feed for ${host} failed (HTTP ${response.status})`)
      }
      return parseFeed(await response.text())
        .filter((post) => types.includes(post.type))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit)
    },
  }
}
