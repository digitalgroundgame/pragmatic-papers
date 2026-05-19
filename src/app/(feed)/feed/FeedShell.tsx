"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArticleView } from "./ArticleView"
import { FeedShellContext, type FeedShellContextValue } from "./FeedShellContext"
import { usePageMemory } from "./hooks/usePageMemory"
import type { FeedArticle, FeedBatch } from "./types"

interface FeedShellProps {
  initialItems: FeedArticle[]
  initialNextCursor: number | null
}

export function FeedShell({ initialItems, initialNextCursor }: FeedShellProps): React.ReactNode {
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
  const memory = usePageMemory()

  // Active article tracking via IntersectionObserver
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
  }, [articles.length])

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
    if (activeIndex >= articles.length - 3) {
      void loadMore()
    }
  }, [activeIndex, articles.length, loadMore])

  const handlePageChange = useCallback(
    (articleId: number, pageIndex: number) => {
      memory.set(articleId, pageIndex)
    },
    [memory],
  )

  const toggleAutoPlay = useCallback(() => {
    setAutoPlayEnabled((v) => !v)
  }, [])

  const scrollToNextArticle = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy({ top: scroller.clientHeight, behavior: "smooth" })
  }, [])

  // Keyboard: ArrowUp/Down navigate articles; Space toggles auto-play
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
          {articles.map((article, i) => {
            const inWindow = Math.abs(i - activeIndex) <= 1
            return (
              <section
                key={article.id}
                data-idx={i}
                ref={registerSection(i)}
                className="relative h-full w-full snap-start snap-always"
                style={{ height: "100%" }}
              >
                {inWindow ? (
                  <ArticleView
                    article={article}
                    active={i === activeIndex}
                    initialPage={memory.get(article.id)}
                    autoPlayEnabled={effectiveAutoPlay}
                    userAutoPlayEnabled={autoPlayEnabled}
                    onAutoPlayToggle={toggleAutoPlay}
                    onPageChange={(pageIndex) => handlePageChange(article.id, pageIndex)}
                    onEndReached={scrollToNextArticle}
                  />
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
