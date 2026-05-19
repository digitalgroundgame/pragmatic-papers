"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { ArticleView } from "./ArticleView"
import { usePageMemory } from "./hooks/usePageMemory"
import type { FeedArticle, FeedBatch } from "./types"

interface FeedShellProps {
  initialItems: FeedArticle[]
  initialNextCursor: number | null
}

const AUTOPLAY_STORAGE_KEY = "feed:autoplay"

function readStoredAutoPlay(defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue
  try {
    const v = window.localStorage.getItem(AUTOPLAY_STORAGE_KEY)
    if (v === "0") return false
    if (v === "1") return true
  } catch {
    /* ignore */
  }
  return defaultValue
}

function persistAutoPlay(value: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AUTOPLAY_STORAGE_KEY, value ? "1" : "0")
  } catch {
    /* ignore */
  }
}

export function FeedShell({ initialItems, initialNextCursor }: FeedShellProps): React.ReactNode {
  const [articles, setArticles] = useState<FeedArticle[]>(initialItems)
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor)
  const [activeIndex, setActiveIndex] = useState(0)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState<boolean>(() => readStoredAutoPlay(true))

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
    setAutoPlayEnabled((v) => {
      const next = !v
      persistAutoPlay(next)
      return next
    })
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

  return (
    <div
      ref={scrollerRef}
      className="h-dvh w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain bg-black"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {articles.map((article, i) => {
        const inWindow = Math.abs(i - activeIndex) <= 1
        return (
          <section
            key={article.id}
            data-idx={i}
            ref={registerSection(i)}
            className="relative h-dvh w-full snap-start snap-always"
          >
            {inWindow ? (
              <ArticleView
                article={article}
                active={i === activeIndex}
                initialPage={memory.get(article.id)}
                autoPlayEnabled={autoPlayEnabled}
                onAutoPlayToggle={toggleAutoPlay}
                onPageChange={(pageIndex) => handlePageChange(article.id, pageIndex)}
              />
            ) : (
              <div className="h-dvh w-full bg-black" aria-hidden />
            )}
          </section>
        )
      })}
    </div>
  )
}
