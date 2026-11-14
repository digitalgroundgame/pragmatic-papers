import { publicGroups, withOutgoing, type WhipCountCandidate, type WhipCountData } from "./model"

/**
 * The count as the page opens on it: outgoing members aren't counted until a reader asks, so a
 * preview doesn't count them either.
 */
export const asOpened = (data: WhipCountData): WhipCountData => withOutgoing(data, false)

/** A candidate's public backers and those leaning their way. */
export interface CandidateCount {
  candidate: WhipCountCandidate
  backs: number
  leans: number
}

/** The first two candidates, the ones a link preview sets against each other, with their counts. */
export function headToHead(data: WhipCountData): CandidateCount[] {
  const groups = publicGroups(asOpened(data))
  const count = (candidate: WhipCountCandidate, stance: "backs" | "leans"): number =>
    groups.find((g) => g.stance === stance && g.candidate?.id === candidate.id)?.members.length ?? 0
  return data.candidates.slice(0, 2).map((candidate) => ({
    candidate,
    backs: count(candidate, "backs"),
    leans: count(candidate, "leans"),
  }))
}

/**
 * The page's title for search results and link previews, with the count in it:
 * "Chuck Schumer 28, Chris Van Hollen 12: Who will lead Senate Democrats?".
 */
export function whipCountTitle(title: string, data: WhipCountData): string {
  const counts = headToHead(data)
  if (counts.length === 0) return title
  return `${counts.map((c) => `${c.candidate.name} ${c.backs}`).join(", ")}: ${title}`
}

const DAY = 24 * 60 * 60 * 1000

/** Whole days left until the vote, counting a part day as one; null with no vote time. */
export function daysUntilVote(data: WhipCountData, now: Date): number | null {
  if (!data.voteAt) return null
  const left = Date.parse(data.voteAt) - now.getTime()
  if (Number.isNaN(left)) return null
  return left <= 0 ? 0 : Math.ceil(left / DAY)
}

/** The countdown as a line: "17 days to the vote", "1 day to the vote", "Vote day". */
export function countdownLine(data: WhipCountData, now: Date): string | null {
  const days = daysUntilVote(data, now)
  if (days === null) return null
  if (days === 0) return "Vote day"
  return `${days} ${days === 1 ? "day" : "days"} to the vote`
}

/** A short, stable fingerprint of a string (FNV-1a), for a cache-busting query value. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * The preview image's path. Its query changes with the count and with the day, so a platform
 * that keeps images by URL fetches a new one when the count or the countdown changes.
 */
export function whipCountImagePath(slug: string, data: WhipCountData, now: Date): string {
  const day = now.toISOString().slice(0, 10)
  return `/next/whip-counts/${encodeURIComponent(slug)}/image?v=${fingerprint(JSON.stringify(data))}-${day}`
}
