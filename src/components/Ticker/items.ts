/**
 * What the ticker shows, in shapes that don't care which service each item came
 * from. Pure, so the view and its stories never touch a connection.
 */

/** One of our channels' broadcasts: on air now, or scheduled to start soon. */
export interface TickerBroadcast {
  status: "live" | "upcoming"
  title: string
  url: string
  /** When an upcoming broadcast is due to start (ISO 8601). */
  startsAt: string | null
}

export type TickerPostSource = "bluesky" | "x"

/**
 * A link in a post: the text the post shows for it (each service shortens its own way, and a
 * link card shows none), and where it leads.
 */
export interface TickerLink {
  text: string
  url: string
}

export interface TickerPost {
  /** Unique across sources. */
  id: string
  source: TickerPostSource
  text: string
  /** The links the service marked in `text`, in order. */
  links: TickerLink[]
  url: string
  /** ISO 8601. */
  createdAt: string
}

export interface TickerFeed {
  broadcast: TickerBroadcast | null
  posts: TickerPost[]
}

/** How many posts run in the ticker at once. */
export const MAX_POSTS = 8

/** Long posts are cut to this many characters; the link leads to the rest. */
export const MAX_POST_LENGTH = 140

const BARE_URL = /https?:\/\/\S+/g

/**
 * A post's words without its links, on one line. The ticker shows each link as an icon after
 * the words, so a long URL never takes the line.
 */
export function postText(post: Pick<TickerPost, "text" | "links">): string {
  let text = post.text
  for (const link of post.links) if (link.text) text = text.replace(link.text, " ")
  return text.replace(BARE_URL, " ").replace(/\s+/g, " ").trim()
}

/** Where a post's links lead, in order, each once: the marked links, then any bare URL. */
export function postLinks(post: Pick<TickerPost, "text" | "links">): string[] {
  let text = post.text
  for (const link of post.links) if (link.text) text = text.replace(link.text, " ")
  const bare = text.match(BARE_URL) ?? []
  return [...new Set([...post.links.map((link) => link.url), ...bare])]
}

/** The text as it reads, so a cross-post matches its twin: no links, and case is ignored. */
function normalize(post: TickerPost): string {
  return postText(post).toLowerCase() || post.id
}

/**
 * Every source's posts as one list, newest first. The same thing cross-posted to Bluesky and X
 * shows once: the newer copy.
 */
export function mergePosts(sources: TickerPost[][], limit = MAX_POSTS): TickerPost[] {
  const seen = new Set<string>()
  return sources
    .flat()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((post) => {
      const key = normalize(post)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

/** A post on one line, cut at a word boundary when it runs long. */
export function excerpt(text: string, max = MAX_POST_LENGTH): string {
  const line = text.replace(/\s+/g, " ").trim()
  if (line.length <= max) return line
  const cut = line.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`
}

/** About how many characters wide a link icon and its gap are. */
const LINK_WIDTH = 3

/**
 * Seconds for one full pass, so the ticker moves at an easy reading pace however much is in
 * it: about 4.5 characters a second, never faster than a pass every 40 seconds.
 */
export function tickerDuration(posts: TickerPost[]): number {
  const characters = posts.reduce(
    (sum, post) => sum + excerpt(postText(post)).length + postLinks(post).length * LINK_WIDTH,
    0,
  )
  return Math.max(40, Math.round(characters / 4.5))
}
