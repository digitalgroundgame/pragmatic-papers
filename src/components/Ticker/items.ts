/**
 * What the home page ticker shows, in shapes that don't care which service each item came
 * from. Pure, so the view and its stories never touch a connection.
 */

/** The podcast's broadcast: on air now, or scheduled to start soon. */
export interface TickerBroadcast {
  status: "live" | "upcoming"
  title: string
  url: string
  /** When an upcoming broadcast is due to start (ISO 8601). */
  startsAt: string | null
}

export type TickerPostSource = "bluesky" | "x"

export interface TickerPost {
  /** Unique across sources. */
  id: string
  source: TickerPostSource
  text: string
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

/**
 * The text as it reads, so a cross-post matches its twin: links (which each service shortens
 * its own way) and whitespace are left out, and case is ignored.
 */
function normalize(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
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
      const key = normalize(post.text)
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

/**
 * Seconds for one full pass, so the ticker moves at a reading pace however much is in it:
 * about 6 characters a second, never faster than a pass every 30 seconds.
 */
export function tickerDuration(posts: TickerPost[]): number {
  const characters = posts.reduce((sum, post) => sum + excerpt(post.text).length, 0)
  return Math.max(30, Math.round(characters / 6))
}
