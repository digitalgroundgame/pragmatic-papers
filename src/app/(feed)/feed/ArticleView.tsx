"use client"

import { MathJaxProvider } from "@/providers/MathJaxProvider"
import useEmblaCarousel from "embla-carousel-react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { ArticleBlockPage, ArticleContentPage } from "./ArticlePage"
import { AutoPlayToggle } from "./AutoPlayToggle"
import { HeroPage } from "./HeroPage"
import { PageProgress } from "./PageProgress"
import { useArticlePages } from "./hooks/useArticlePages"
import { useAutoPlay } from "./hooks/useAutoPlay"
import type { ArticlePageItem, FeedArticle } from "./types"

interface ArticleViewProps {
  article: FeedArticle
  active: boolean
  initialPage: number
  autoPlayEnabled: boolean
  onAutoPlayToggle: () => void
  onPageChange: (pageIndex: number) => void
  onEndReached: () => void
}

const TOP_INSET = 28 // progress bar row height + a little breathing room
const SWIPE_PAST_END_PX = 60 // forward-swipe distance that triggers next-article on last page

export function ArticleView({
  article,
  active,
  initialPage,
  autoPlayEnabled,
  onAutoPlayToggle,
  onPageChange,
  onEndReached,
}: ArticleViewProps): React.ReactNode {
  const pages = useArticlePages(article)
  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: "x",
    loop: false,
    containScroll: "trimSnaps",
    duration: 18,
    startIndex: Math.min(initialPage, Math.max(0, pages.length - 1)),
    watchDrag: active,
  })
  const [pageIndex, setPageIndex] = useState(Math.min(initialPage, Math.max(0, pages.length - 1)))

  // Keep embla's drag listener in sync with whether this article is active.
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.reInit({ watchDrag: active })
  }, [emblaApi, active])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = (): void => {
      const idx = emblaApi.selectedScrollSnap()
      setPageIndex(idx)
      onPageChange(idx)
    }
    emblaApi.on("select", onSelect)
    onSelect()
    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, onPageChange])

  const onEndReachedRef = useRef(onEndReached)
  useEffect(() => {
    onEndReachedRef.current = onEndReached
  }, [onEndReached])

  const advance = useCallback(() => {
    if (!emblaApi) return
    if (emblaApi.canScrollNext()) {
      emblaApi.scrollNext()
    } else {
      onEndReachedRef.current()
    }
  }, [emblaApi])

  const currentPage: ArticlePageItem | undefined = pages[pageIndex]
  const { progress } = useAutoPlay({
    active,
    enabled: autoPlayEnabled,
    page: currentPage,
    onAdvance: advance,
  })

  const handleJump = useCallback(
    (i: number) => {
      emblaApi?.scrollTo(i)
    },
    [emblaApi],
  )

  // Restore the remembered page when this article becomes active again.
  useEffect(() => {
    if (!emblaApi || !active) return
    const desired = Math.min(initialPage, Math.max(0, pages.length - 1))
    if (emblaApi.selectedScrollSnap() !== desired) {
      emblaApi.scrollTo(desired, true)
    }
  }, [active, emblaApi, initialPage, pages.length])

  // Detect a forward swipe past the last page and treat it as "go to next article".
  // Embla can't advance past the last snap, but the user's intent is clear, so we
  // call onEndReached to scroll the vertical container.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = swipeStartRef.current
      swipeStartRef.current = null
      if (!start || !emblaApi) return
      const dx = start.x - e.clientX
      const dy = Math.abs(start.y - e.clientY)
      // Forward swipe (left) + mostly horizontal + on last page.
      if (dx > SWIPE_PAST_END_PX && dx > dy * 1.5 && !emblaApi.canScrollNext()) {
        onEndReachedRef.current()
      }
    },
    [emblaApi],
  )

  const view = (
    <div
      className="relative h-dvh w-full overflow-hidden bg-black"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeStartRef.current = null
      }}
    >
      <div ref={emblaRef} className="h-dvh overflow-hidden">
        <div className="flex h-dvh" style={{ touchAction: "pan-y pinch-zoom" }}>
          {pages.map((page, i) => (
            <div
              key={i}
              className="relative h-dvh w-full shrink-0 grow-0 basis-full"
              role="group"
              aria-roledescription="page"
              aria-label={`Page ${i + 1} of ${pages.length}`}
            >
              {page.kind === "hero" && <HeroPage article={article} topInset={TOP_INSET} />}
              {page.kind === "content" && (
                <ArticleContentPage article={article} page={page} topInset={TOP_INSET} />
              )}
              {page.kind === "block" && (
                <ArticleBlockPage article={article} page={page} topInset={TOP_INSET} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}
      >
        <div className="pointer-events-auto flex-1">
          <PageProgress
            total={pages.length}
            activeIndex={pageIndex}
            progress={progress}
            onJump={handleJump}
          />
        </div>
        <div className="pointer-events-auto">
          <AutoPlayToggle isPlaying={autoPlayEnabled} onToggle={onAutoPlayToggle} />
        </div>
      </div>
    </div>
  )

  return <MathJaxProvider enableMathRendering={article.enableMathRendering}>{view}</MathJaxProvider>
}
