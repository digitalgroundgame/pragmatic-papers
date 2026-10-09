import { Pause, Play } from "lucide-react"
import type { CSSProperties, FC, SVGProps } from "react"

import { BlueskyIcon, XIcon, YoutubeIcon } from "@/components/SocialLinks/icons"
import { formatFullTimestamp, formatTimeOfDay } from "@/heros/ArticleHero/dates"
import { cn } from "@/utilities/utils"

import { LinkIcon, shortURL } from "./LinkIcon"
import { LazyLinkTooltip } from "./LinkTooltip.lazy"
import {
  excerpt,
  postLinks,
  postText,
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
      className={cn("flex shrink-0 items-center gap-6 pr-6", copy && "motion-reduce:hidden")}
    >
      {posts.map((post) => {
        const { name, Icon } = SOURCES[post.source]
        const links = postLinks(post)
        return (
          <li key={post.id} className="flex shrink-0 items-center gap-6">
            <span aria-hidden="true" className="bg-brand size-1 rounded-full" />
            {/* The words link to the post, and each link in it is an icon beside them: an
                anchor can't hold another, and a URL would take the line. */}
            <span className="flex items-center gap-2 whitespace-nowrap">
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group text-muted-foreground hover:text-foreground flex items-center gap-2 font-serif transition-colors"
              >
                {/* A solid mark reads heavier than the thin serif beside it, so it's dimmed until the
                    post is pointed at. */}
                <Icon className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                <span className="sr-only">On {name}:</span>
                <span className="group-hover:underline">
                  {excerpt(postText(post)) || shortURL(links[0] ?? post.url)}
                </span>
              </a>
              {links.map((url) =>
                copy ? <LinkIcon key={url} url={url} /> : <LazyLinkTooltip key={url} url={url} />,
              )}
            </span>
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
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", beside && "max-sm:hidden")}>
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
      <label className="ticker-switch text-muted-foreground hover:text-foreground focus-within:ring-ring relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full focus-within:ring-2 motion-reduce:hidden">
        <input type="checkbox" className="ticker-pause sr-only" aria-label="Pause ticker" />
        <Pause aria-hidden="true" className="ticker-pause-icon size-3.5 fill-current" />
        <Play aria-hidden="true" className="ticker-play-icon size-3.5 fill-current" />
      </label>
    </div>
  )
}

/** The ticker's label: what the strip is, set like a tile's kicker. */
const LABEL = "text-brand-text shrink-0 font-serif text-xs font-bold tracking-wider uppercase"

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
        "group flex min-w-0 items-center gap-2.5",
        pinned && "sm:max-w-[min(45%,36rem)] sm:shrink-0",
      )}
    >
      {live ? (
        <span className="bg-brand-fill flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 font-sans text-xs font-bold tracking-wider text-white uppercase">
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none"
          />
          Live
        </span>
      ) : (
        <span className={LABEL}>Upcoming</span>
      )}
      <YoutubeIcon className="size-4 shrink-0" />
      <span className="truncate font-sans font-semibold group-hover:underline">
        {broadcast.title}
      </span>
      {!live && broadcast.startsAt && (
        <time
          dateTime={broadcast.startsAt}
          title={formatFullTimestamp(broadcast.startsAt)}
          className="text-muted-foreground shrink-0 font-serif"
        >
          {formatTimeOfDay(broadcast.startsAt)}
        </time>
      )}
    </a>
  )
}

/**
 * The ticker: a YouTube broadcast pinned at the start while it's live (or about to be), then
 * our latest posts scrolling past. Server-rendered at a fixed height, and moved by CSS alone
 * (`.ticker-*` in `globals.css`), so it ships no JavaScript and shifts nothing as it loads.
 * The scroll pauses on hover, on focus, with its pause switch, and stops for readers who ask
 * for reduced motion, leaving the posts to scroll by hand.
 */
export function TickerView({ broadcast, posts }: TickerFeed): React.ReactNode {
  if (!broadcast && posts.length === 0) return null

  return (
    <section aria-label="Live and latest" className="ticker mb-6 border-b md:mb-10 md:border-t">
      {/* The strip runs the window's full width, wider than the page's container, between two
          hairlines rather than on a band of its own, so it reads as part of the masthead. The
          mega menu sits right above on wider screens; on phones the header's own border is
          the top line. Its start lines up with the container's content (`container` is 80rem
          with 1rem of padding), so the label sits over the page's left edge; the posts run on
          to the window's. */}
      <div className="flex h-10 items-center gap-4 pr-4 pl-[max(1rem,calc((100%-80rem)/2+1rem))] text-sm">
        {broadcast ? (
          <Broadcast broadcast={broadcast} pinned={posts.length > 0} />
        ) : (
          <span className={LABEL}>Latest</span>
        )}
        {posts.length > 0 && <Posts posts={posts} beside={Boolean(broadcast)} />}
      </div>
    </section>
  )
}
