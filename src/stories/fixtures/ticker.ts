import type { TickerBroadcast, TickerPost } from "@/components/Ticker/items"

/** Ticker content for stories and tests. */

export const liveBroadcast: TickerBroadcast = {
  status: "live",
  title: "Pragmatic Papers Live: what the shutdown fight is really about",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  startsAt: null,
}

export const upcomingBroadcast: TickerBroadcast = {
  status: "upcoming",
  title: "Pragmatic Papers Live: the week in Congress",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  startsAt: "2026-10-07T23:00:00Z",
}

export const tickerPosts: TickerPost[] = [
  {
    id: "bluesky:1",
    source: "bluesky",
    text: "New in Volume 12: why permitting reform is the climate fight nobody is watching.",
    url: "https://bsky.app/profile/thepragmaticpapers.bsky.social/post/1",
    createdAt: "2026-10-07T16:00:00Z",
  },
  {
    id: "x:2",
    source: "x",
    text: "The filibuster, explained in five charts. Read it before the next cloture vote.",
    url: "https://x.com/PragPapers/status/2",
    createdAt: "2026-10-07T14:00:00Z",
  },
  {
    id: "bluesky:3",
    source: "bluesky",
    text: "We're live on YouTube at 7 p.m. ET tonight with the editors. Bring your questions about the budget, the courts, and anything else on your mind this week.",
    url: "https://bsky.app/profile/thepragmaticpapers.bsky.social/post/3",
    createdAt: "2026-10-06T22:00:00Z",
  },
]
