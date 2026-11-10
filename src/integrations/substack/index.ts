import { env, type Integration } from "../types"

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
}

export interface SubstackPublicationsIntegration extends Integration {
  /**
   * The publications to read, each as the host its feed is on: `publications` when it has any
   * (the admin's list), else the publications variable, else the default.
   */
  publications(publications?: readonly string[] | null): string[]
  /**
   * One publication's newest posts, newest first, from its RSS feed. Throws when Substack
   * refuses the request.
   */
  recentPosts(opts: {
    publication: string
    limit?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<SubstackPost[]>
}

export interface SubstackPublicationsOptions {
  id: string
  label: string
  defaultPublications: readonly string[]
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
    async recentPosts({ publication, limit = 5, fetchImpl = fetch, signal }) {
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
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit)
    },
  }
}
