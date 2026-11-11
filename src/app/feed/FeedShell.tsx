"use client"

import React, { useEffect, useEffectEvent, useRef, useState } from "react"
import { AdSlotView } from "./AdSlotView"
import { ArticleView } from "./ArticleView"
import { INTERACTIVE_SEL } from "./constants"
import { FEED_AD_INTERVAL, FEED_ADS } from "./ads/registry"
import { usePageMemory } from "./hooks/usePageMemory"
import type { FeedBatch, FeedSlot, RenderedFeedArticle } from "./types"

const RELOADED_KEY = "pp:feed:reloaded-after-load-failure"

// One reload per tab session, so a load-more that keeps failing (the server is
// down, say) can't put the page in a reload loop.
function reloadOnce(): void {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return
    sessionStorage.setItem(RELOADED_KEY, "1")
  } catch {
    // Storage blocked: skip the reload rather than risk a loop.
    return
  }
  window.location.reload()
}

interface FeedShellProps {
  initialItems: RenderedFeedArticle[]
  initialNextCursor: number | null
  /** Article to open on mount; seeds page memory and overrides the initial scroll. */
  initialPinnedArticleId?: number
  /** In-article page index to open at when `initialPinnedArticleId` is set. */
  initialPageIndex?: number
  /**
   * The next page of the feed: the `loadFeedBatch` server action, passed down by the page.
   * Imported here instead, webpack would compile the action for client code, a second
   * copy of everything it reaches, Payload's config included.
   */
  loadBatch: (cursor: number) => Promise<FeedBatch>
}

export function FeedShell({
  initialItems,
  initialNextCursor,
  initialPinnedArticleId,
  initialPageIndex,
  loadBatch,
}: FeedShellProps): React.ReactNode {
  const [articles, setArticles] = useState<RenderedFeedArticle[]>(initialItems)
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor)
  const [activeIndex, setActiveIndex] = useState(0)
  // Auto-play is always on at session start. Tap-to-pause is session-only:
  // a reload returns to the playing state by design.
  const [autoPlayEnabled, setAutoPlayEnabled] = useState<boolean>(true)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map())
  const loadingMoreRef = useRef(false)

  // Seed page memory for the pinned article so the first mount of
  // ArticleView picks it up via `initialPage`. The hook reads it on the first render only.
  const memory = usePageMemory(
    initialPinnedArticleId !== undefined && initialPageIndex !== undefined && initialPageIndex > 0
      ? [[initialPinnedArticleId, initialPageIndex]]
      : [],
  )

  // Track the current in-article page index for the active article so the
  // URL can reflect ?p=<page>.
  const [activePageIndex, setActivePageIndex] = useState(initialPageIndex ?? 0)

  const slots = ((): FeedSlot[] => {
    if (FEED_ADS.length === 0 || FEED_AD_INTERVAL <= 0) {
      return articles.map((article) => ({
        kind: "article" as const,
        key: `a:${article.article.id}`,
        article,
      }))
    }
    const out: FeedSlot[] = []
    let adCursor = 0
    articles.forEach((article, i) => {
      out.push({ kind: "article", key: `a:${article.article.id}`, article })
      if ((i + 1) % FEED_AD_INTERVAL === 0) {
        const ad = FEED_ADS[adCursor % FEED_ADS.length]!
        out.push({ kind: "ad", key: `ad:${ad.id}:${i}`, ad })
        adCursor += 1
      }
    })
    return out
  })()

  // Active slot tracking via IntersectionObserver. An effect event, so the observer reads the
  // current activeIndex (its tiebreaker) without being rebuilt every time it changes.
  const onIntersect = useEffectEvent((entries: IntersectionObserverEntry[]) => {
    let bestIdx = activeIndex
    let bestRatio = 0
    for (const entry of entries) {
      const idxAttr = (entry.target as HTMLElement).dataset.idx
      if (!idxAttr) continue
      if (entry.intersectionRatio > bestRatio) {
        bestRatio = entry.intersectionRatio
        bestIdx = Number(idxAttr)
      }
    }
    if (bestRatio > 0.55) setActiveIndex(bestIdx)
  })
  const slotCount = slots.length
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const io = new IntersectionObserver((entries) => onIntersect(entries), {
      root: scroller,
      threshold: [0, 0.25, 0.55, 0.85, 1],
    })

    sectionRefs.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // Rebuilt when slots are added, so the observer watches the new sections too.
  }, [slotCount])

  // Load more when nearing the end, and again once a batch moves the cursor.
  const loadMore = useEffectEvent(async (): Promise<void> => {
    if (loadingMoreRef.current || nextCursor === null) return
    loadingMoreRef.current = true
    const batch = await loadBatch(nextCursor)
      .catch((error: unknown) => {
        // Most likely a page from an earlier deploy calling a server action the
        // new build no longer has. Reload once: the URL already names the
        // current article, so the reader lands back where they were.
        console.error("Couldn't load more of the feed", error)
        reloadOnce()
        return null
      })
      // `.finally()` rather than `try`/`finally`, which the React Compiler can't compile yet.
      .finally(() => {
        loadingMoreRef.current = false
      })
    if (!batch) {
      // Stop paging rather than retrying the same request on every scroll.
      setNextCursor(null)
      return
    }
    setArticles((prev) => {
      const seen = new Set(prev.map((a) => a.article.id))
      const merged = [...prev]
      for (const item of batch.items) {
        if (!seen.has(item.article.id)) merged.push(item)
      }
      return merged
    })
    setNextCursor(batch.nextCursor)
  })

  useEffect(() => {
    if (activeIndex >= slotCount - 3) {
      void loadMore()
    }
  }, [activeIndex, slotCount, nextCursor])

  const handlePageChange = (articleId: number, pageIndex: number) => {
    memory.set(articleId, pageIndex)
    setActivePageIndex(pageIndex)
  }

  // Sync the URL with the active article + page index, debounced so a fast
  // swipe doesn't replaceState every frame. Ads have no slug, so skip.
  const urlSyncTimerRef = useRef<number | null>(null)
  useEffect(() => {
    const slot = slots[activeIndex]
    if (!slot || slot.kind !== "article") return
    const slug = slot.article.article.slug
    if (!slug) return

    if (urlSyncTimerRef.current !== null) window.clearTimeout(urlSyncTimerRef.current)
    urlSyncTimerRef.current = window.setTimeout(() => {
      const url = `/feed/articles/${slug}${activePageIndex > 0 ? `?p=${activePageIndex}` : ""}`
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", url)
      }
    }, 250)

    return () => {
      if (urlSyncTimerRef.current !== null) {
        window.clearTimeout(urlSyncTimerRef.current)
        urlSyncTimerRef.current = null
      }
    }
  }, [activeIndex, activePageIndex, slots])

  // When the active slot changes, the per-article state is reset by ArticleView's
  // own initialPage logic — mirror that here so the URL doesn't carry the
  // previous article's page index into the next slot. Done as a sync
  // render-time compare to avoid the cascading-render lint warning.
  const [lastActiveSlotKey, setLastActiveSlotKey] = useState<string | null>(null)
  const currentSlotKey = slots[activeIndex]?.key ?? null
  if (currentSlotKey !== lastActiveSlotKey) {
    setLastActiveSlotKey(currentSlotKey)
    const slot = slots[activeIndex]
    if (slot?.kind === "article") {
      const remembered = memory.get(slot.article.article.id)
      if (remembered !== activePageIndex) setActivePageIndex(remembered)
    }
  }

  const toggleAutoPlay = () => {
    setAutoPlayEnabled((v) => !v)
  }

  const scrollToNextSlot = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy({ top: scroller.clientHeight, behavior: "smooth" })
  }

  // Keyboard: ArrowUp/Down navigate slots; Space toggles auto-play
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        scroller.scrollBy({ top: scroller.clientHeight, behavior: "smooth" })
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        scroller.scrollBy({ top: -scroller.clientHeight, behavior: "smooth" })
      } else if (e.key === " ") {
        // Space presses a focused button or link; only toggle when it wouldn't.
        if (e.target instanceof Element && e.target.closest(INTERACTIVE_SEL)) return
        e.preventDefault()
        setAutoPlayEnabled((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const registerSection = (idx: number) => {
    return (el: HTMLElement | null) => {
      if (el) sectionRefs.current.set(idx, el)
      else sectionRefs.current.delete(idx)
    }
  }

  return (
    <>
      <div className="bg-background h-dvh w-full md:flex md:items-center md:justify-center">
        <div
          ref={scrollerRef}
          className="bg-background h-dvh w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain md:my-4 md:h-[min(844px,calc(100dvh-2rem))] md:w-[min(420px,calc(100vw-2rem))] md:rounded-3xl md:shadow-2xl md:ring-1 md:ring-white/10"
          style={{ scrollSnapType: "y mandatory" }}
        >
          {slots.map((slot, i) => {
            const inWindow = Math.abs(i - activeIndex) <= 1
            return (
              <section
                key={slot.key}
                data-idx={i}
                ref={registerSection(i)}
                className="relative h-full w-full snap-start snap-always"
                style={{ height: "100%" }}
              >
                {inWindow ? (
                  slot.kind === "article" ? (
                    <ArticleView
                      article={slot.article}
                      active={i === activeIndex}
                      initialPage={memory.get(slot.article.article.id)}
                      autoPlayEnabled={autoPlayEnabled}
                      userAutoPlayEnabled={autoPlayEnabled}
                      onAutoPlayToggle={toggleAutoPlay}
                      onPageChange={(pageIndex) =>
                        handlePageChange(slot.article.article.id, pageIndex)
                      }
                      onEndReached={scrollToNextSlot}
                    />
                  ) : (
                    <AdSlotView
                      ad={slot.ad}
                      active={i === activeIndex}
                      autoPlayEnabled={autoPlayEnabled}
                      userAutoPlayEnabled={autoPlayEnabled}
                      onAutoPlayToggle={toggleAutoPlay}
                      onEndReached={scrollToNextSlot}
                    />
                  )
                ) : (
                  <div className="bg-background h-full w-full" aria-hidden />
                )}
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
