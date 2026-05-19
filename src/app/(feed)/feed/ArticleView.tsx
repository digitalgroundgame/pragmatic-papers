"use client"

import { MathJaxProvider } from "@/providers/MathJaxProvider"
import { cn } from "@/utilities/utils"
import useEmblaCarousel from "embla-carousel-react"
import { Pause, Play } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { ArticleBlockPage, ArticleContentPage } from "./ArticlePage"
import { FeedByline } from "./FeedByline"
import { HeroPage } from "./HeroPage"
import { PageProgress } from "./PageProgress"
import { useArticlePages } from "./hooks/useArticlePages"
import { useAutoPlay } from "./hooks/useAutoPlay"
import type { ArticlePageItem, FeedArticle } from "./types"

interface ArticleViewProps {
  article: FeedArticle
  active: boolean
  initialPage: number
  /** The effective enabled flag (user toggle AND no interaction pause). */
  autoPlayEnabled: boolean
  /** The user-facing toggle state — drives the centered pause indicator. */
  userAutoPlayEnabled: boolean
  onAutoPlayToggle: () => void
  onPageChange: (pageIndex: number) => void
  onEndReached: () => void
}

const TOP_INSET = 64 // progress bar + article byline row + breathing room
const SWIPE_PAST_END_PX = 60 // forward-swipe distance that triggers next-article on last page
const TAP_MAX_MOVE_PX = 8 // pointer movement under this counts as a tap, not a drag
const TAP_MAX_MS = 350 // and only if the press is shorter than this
const TAP_INDICATOR_MS = 600 // how long the play/pause flash stays visible

const INTERACTIVE_SEL = 'button, a, [role="tab"], [role="button"], input, textarea, select, label'

export function ArticleView({
  article,
  active,
  initialPage,
  autoPlayEnabled,
  userAutoPlayEnabled,
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
    // Lower than the default (10): less wrist motion needed before a horizontal
    // drag activates, so swipes feel quicker without hijacking vertical scroll.
    dragThreshold: 4,
    startIndex: Math.min(initialPage, Math.max(0, pages.length - 1)),
    watchDrag: active,
  })
  const [pageIndex, setPageIndex] = useState(Math.min(initialPage, Math.max(0, pages.length - 1)))
  const [showTapIndicator, setShowTapIndicator] = useState(false)

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

  const onAutoPlayToggleRef = useRef(onAutoPlayToggle)
  useEffect(() => {
    onAutoPlayToggleRef.current = onAutoPlayToggle
  }, [onAutoPlayToggle])

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

  // Briefly flash the pause/play icon when the user taps to toggle.
  useEffect(() => {
    if (!showTapIndicator) return
    const id = window.setTimeout(() => setShowTapIndicator(false), TAP_INDICATOR_MS)
    return () => window.clearTimeout(id)
  }, [showTapIndicator])

  // Tap (center) → toggle auto-play. Swipe-past-end on last page → next article.
  // Both gestures observe the same pointer events alongside Embla; Embla still
  // owns the actual horizontal drag.
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }, [])
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = swipeStartRef.current
      swipeStartRef.current = null
      if (!start) return
      const dx = start.x - e.clientX
      const dy = start.y - e.clientY
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      const dt = Date.now() - start.t

      // Forward swipe past end → advance article (only on last page).
      if (dx > SWIPE_PAST_END_PX && ax > ay * 1.5 && emblaApi && !emblaApi.canScrollNext()) {
        onEndReachedRef.current()
        return
      }

      // Tap → toggle auto-play. Ignore taps that landed on an interactive child
      // so buttons, segment tabs, and form fields still receive their click.
      if (ax < TAP_MAX_MOVE_PX && ay < TAP_MAX_MOVE_PX && dt < TAP_MAX_MS) {
        const target = e.target as Element | null
        if (target && target.closest(INTERACTIVE_SEL)) return
        onAutoPlayToggleRef.current()
        setShowTapIndicator(true)
      }
    },
    [emblaApi],
  )

  const view = (
    <div
      className="bg-background relative h-full w-full overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeStartRef.current = null
      }}
    >
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full" style={{ touchAction: "pan-y pinch-zoom" }}>
          {pages.map((page, i) => (
            <div
              key={i}
              className="relative h-full w-full shrink-0 grow-0 basis-full"
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
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}
      >
        <div className="pointer-events-auto">
          <PageProgress
            total={pages.length}
            activeIndex={pageIndex}
            progress={progress}
            onJump={handleJump}
          />
        </div>
        <div
          className={cn(
            "transition-opacity duration-300 ease-out",
            currentPage?.kind === "hero" ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <FeedByline article={article} />
        </div>
      </div>

      {/* Center pause/play flash — purely visual, fades out quickly */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-200",
          showTapIndicator ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/55 backdrop-blur-md">
          {userAutoPlayEnabled ? (
            <Play className="size-8 text-white" fill="currentColor" />
          ) : (
            <Pause className="size-8 text-white" fill="currentColor" />
          )}
        </div>
      </div>
    </div>
  )

  return <MathJaxProvider enableMathRendering={article.enableMathRendering}>{view}</MathJaxProvider>
}
