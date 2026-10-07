import { Pause, Play } from "lucide-react"
import type { CSSProperties, FC, SVGProps } from "react"

import { BlueskyIcon, XIcon, YoutubeIcon } from "@/components/SocialLinks/icons"
import { formatFullTimestamp, formatTimeOfDay } from "@/heros/ArticleHero/dates"
import { cn } from "@/utilities/utils"

import {
  excerpt,
  tickerDuration,
  type TickerBroadcast,
  type TickerFeed,
  type TickerPost,
  type TickerPostSource,
} from "./items"

const SOURCES: Record<TickerPostSource, { name: string; Icon: FC<SVGProps<SVGSVGElement>> }> = {
  bluesky: { name: "Bluesky", Icon: BlueskyIcon },
  x: { name: "X", Icon: XIcon },
}

function PostList({
  posts,
  copy = false,
}: {
  posts: TickerPost[]
  copy?: boolean
}): React.ReactNode {
  return (
    <ul
      aria-label={copy ? undefined : "Latest posts"}
      aria-hidden={copy || undefined}
      inert={copy || undefined}
      className={cn("flex shrink-0 items-center gap-8 pr-8", copy && "motion-reduce:hidden")}
    >
      {posts.map((post) => {
        const { name, Icon } = SOURCES[post.source]
        return (
          <li key={post.id} className="shrink-0">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 whitespace-nowrap hover:underline"
            >
              <Icon className="text-muted-foreground size-3.5 shrink-0" />
              <span className="sr-only">On {name}:</span>
              {excerpt(post.text)}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function Posts({ posts, beside }: { posts: TickerPost[]; beside: boolean }): React.ReactNode {
  return (
    // Beside a broadcast on a phone, there's room for one or the other, and the broadcast is
    // what a reader can't find elsewhere.
    <div className={cn("flex min-w-0 flex-1 items-center gap-3", beside && "max-sm:hidden")}>
      <div className="ticker-viewport relative min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        <div
          className="ticker-track flex w-max"
          style={{ "--ticker-duration": `${tickerDuration(posts)}s` } as CSSProperties}
        >
          <PostList posts={posts} />
          {/* The second copy is what makes the loop seamless: when the first has scrolled out,
              the track jumps back to where the second began. It is invisible to assistive
              tech and keyboards, and not drawn at all when the ticker doesn't move. */}
          <PostList posts={posts} copy />
        </div>
      </div>
      <label className="hover:bg-accent focus-within:ring-ring flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm focus-within:ring-2 motion-reduce:hidden">
        <input type="checkbox" className="ticker-pause sr-only" aria-label="Pause ticker" />
        <Pause aria-hidden="true" className="ticker-pause-icon size-4" />
        <Play aria-hidden="true" className="ticker-play-icon size-4" />
      </label>
    </div>
  )
}

function Broadcast({
  broadcast,
  pinned,
}: {
  broadcast: TickerBroadcast
  pinned: boolean
}): React.ReactNode {
  const live = broadcast.status === "live"
  return (
    <a
      href={broadcast.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex min-w-0 items-center gap-2 font-medium hover:underline",
        pinned && "sm:max-w-[45%] sm:shrink-0",
      )}
    >
      <YoutubeIcon className="size-4 shrink-0" />
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-bold uppercase",
          live ? "bg-red-700 text-white" : "border",
        )}
      >
        {live && (
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none"
          />
        )}
        {live ? "Live" : "Upcoming"}
      </span>
      <span className="truncate">{broadcast.title}</span>
      {!live && broadcast.startsAt && (
        <time
          dateTime={broadcast.startsAt}
          title={formatFullTimestamp(broadcast.startsAt)}
          className="text-muted-foreground shrink-0"
        >
          {formatTimeOfDay(broadcast.startsAt)}
        </time>
      )}
    </a>
  )
}

/**
 * The home page ticker: the podcast pinned at the start while it's live (or about to be), then
 * our latest posts scrolling past. Server-rendered at a fixed height, and moved by CSS alone
 * (`.ticker-*` in `globals.css`), so it ships no JavaScript and shifts nothing as it loads.
 * The scroll pauses on hover, on focus, with its pause switch, and stops for readers who ask
 * for reduced motion, leaving the posts to scroll by hand.
 */
export function TickerView({ broadcast, posts }: TickerFeed): React.ReactNode {
  if (!broadcast && posts.length === 0) return null

  return (
    <section aria-label="Live and latest" className="ticker bg-muted/40 border-b">
      <div className="container flex h-10 items-center gap-3 text-sm">
        {broadcast && <Broadcast broadcast={broadcast} pinned={posts.length > 0} />}
        {posts.length > 0 && <Posts posts={posts} beside={Boolean(broadcast)} />}
      </div>
    </section>
  )
}
