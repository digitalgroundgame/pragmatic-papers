"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AdSlotView } from "./AdSlotView"
import { ArticleView } from "./ArticleView"
import { FEED_AD_INTERVAL, FEED_ADS } from "./ads/registry"
import { FeedShellContext, type FeedShellContextValue } from "./FeedShellContext"
import { usePageMemory } from "./hooks/usePageMemory"
import type { FeedArticle, FeedBatch, FeedSlot } from "./types"

interface FeedShellProps {
  initialItems: FeedArticle[]
  initialNextCursor: number | null
  /** Article to open on mount; seeds page memory and overrides the initial scroll. */
  initialPinnedArticleId?: number
  /** In-article page index to open at when `initialPinnedArticleId` is set. */
  initialPageIndex?: number
}

export function FeedShell({
  initialItems,
  initialNextCursor,
  initialPinnedArticleId,
  initialPageIndex,
}: FeedShellProps): React.ReactNode {
  const [articles, setArticles] = useState<FeedArticle[]>(initialItems)
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor)
  const [activeIndex, setActiveIndex] = useState(0)
  // Auto-play is always on at session start. Tap-to-pause is session-only:
  // a reload returns to the playing state by design.
  const [autoPlayEnabled, setAutoPlayEnabled] = useState<boolean>(true)
  const [interactionPauseCount, setInteractionPauseCount] = useState(0)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map())
  const loadingMoreRef = useRef(false)

  // Seed page memory for the pinned article so the first mount of
  // ArticleView picks it up via `initialPage`.
  const memorySeed = useMemo<Array<[number, number]>>(() => {
    if (
      initialPinnedArticleId !== undefined &&
      initialPageIndex !== undefined &&
      initialPageIndex > 0
    ) {
      return [[initialPinnedArticleId, initialPageIndex]]
    }
    return []
    // The pinned identity is fixed for the lifetime of the component —
    // depending on the raw props keeps the seed stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const memory = usePageMemory(memorySeed)

  // Track the current in-article page index for the active article so the
  // URL can reflect ?p=<page>.
  const [activePageIndex, setActivePageIndex] = useState(initialPageIndex ?? 0)

  const slots = useMemo<FeedSlot[]>(() => {
    if (FEED_ADS.length === 0 || FEED_AD_INTERVAL <= 0) {
      return articles.map((article) => ({
        kind: "article" as const,
        key: `a:${article.id}`,
        article,
      }))
    }
    const out: FeedSlot[] = []
    let adCursor = 0
    articles.forEach((article, i) => {
      out.push({ kind: "article", key: `a:${article.id}`, article })
      if ((i + 1) % FEED_AD_INTERVAL === 0) {
        const ad = FEED_ADS[adCursor % FEED_ADS.length]!
        out.push({ kind: "ad", key: `ad:${ad.id}:${i}`, ad })
        adCursor += 1
      }
    })
    return out
  }, [articles])

  // Active slot tracking via IntersectionObserver
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const io = new IntersectionObserver(
      (entries) => {
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
      },
      { root: scroller, threshold: [0, 0.25, 0.55, 0.85, 1] },
    )

    sectionRefs.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // We intentionally don't depend on activeIndex: io callback reads it from closure as a tiebreaker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.length])

  // Load more when nearing the end
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || nextCursor === null) return
    loadingMoreRef.current = true
    try {
      const res = await fetch(`/api/feed?cursor=${nextCursor}`, { cache: "no-store" })
      if (!res.ok) return
      const batch = (await res.json()) as FeedBatch
      setArticles((prev) => {
        const seen = new Set(prev.map((a) => a.id))
        const merged = [...prev]
        for (const item of batch.items) {
          if (!seen.has(item.id)) merged.push(item)
        }
        return merged
      })
      setNextCursor(batch.nextCursor)
    } finally {
      loadingMoreRef.current = false
    }
  }, [nextCursor])

  useEffect(() => {
    if (activeIndex >= slots.length - 3) {
      void loadMore()
    }
  }, [activeIndex, slots.length, loadMore])

  const handlePageChange = useCallback(
    (articleId: number, pageIndex: number) => {
      memory.set(articleId, pageIndex)
      setActivePageIndex(pageIndex)
    },
    [memory],
  )

  // Sync the URL with the active article + page index, debounced so a fast
  // swipe doesn't replaceState every frame. Ads have no slug, so skip.
  const urlSyncTimerRef = useRef<number | null>(null)
  useEffect(() => {
    const slot = slots[activeIndex]
    if (!slot || slot.kind !== "article") return
    const slug = slot.article.slug
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
      const remembered = memory.get(slot.article.id)
      if (remembered !== activePageIndex) setActivePageIndex(remembered)
    }
  }

  const toggleAutoPlay = useCallback(() => {
    setAutoPlayEnabled((v) => !v)
  }, [])

  const scrollToNextSlot = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy({ top: scroller.clientHeight, behavior: "smooth" })
  }, [])

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
        e.preventDefault()
        toggleAutoPlay()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleAutoPlay])

  const registerSection = useCallback((idx: number) => {
    return (el: HTMLElement | null) => {
      if (el) sectionRefs.current.set(idx, el)
      else sectionRefs.current.delete(idx)
    }
  }, [])

  const contextValue = useMemo<FeedShellContextValue>(
    () => ({
      pauseAutoPlay: () => setInteractionPauseCount((c) => c + 1),
      resumeAutoPlay: () => setInteractionPauseCount((c) => Math.max(0, c - 1)),
    }),
    [],
  )

  const effectiveAutoPlay = autoPlayEnabled && interactionPauseCount === 0

  return (
    <FeedShellContext.Provider value={contextValue}>
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
                      initialPage={memory.get(slot.article.id)}
                      autoPlayEnabled={effectiveAutoPlay}
                      userAutoPlayEnabled={autoPlayEnabled}
                      onAutoPlayToggle={toggleAutoPlay}
                      onPageChange={(pageIndex) => handlePageChange(slot.article.id, pageIndex)}
                      onEndReached={scrollToNextSlot}
                    />
                  ) : (
                    <AdSlotView
                      ad={slot.ad}
                      active={i === activeIndex}
                      autoPlayEnabled={effectiveAutoPlay}
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
    </FeedShellContext.Provider>
  )
}
