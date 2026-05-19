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
}

const TOP_INSET = 28 // progress bar row height + a little breathing room

export function ArticleView({
  article,
  active,
  initialPage,
  autoPlayEnabled,
  onAutoPlayToggle,
  onPageChange,
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
  const userInteractedRef = useRef(false)

  // Keep embla's drag listener in sync with whether this article is active.
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.reInit({ watchDrag: active })
  }, [emblaApi, active])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap()
      setPageIndex(idx)
      onPageChange(idx)
    }
    const onPointerDown = () => {
      userInteractedRef.current = true
    }
    emblaApi.on("select", onSelect)
    emblaApi.on("pointerDown", onPointerDown)
    onSelect()
    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("pointerDown", onPointerDown)
    }
  }, [emblaApi, onPageChange])

  const advance = useCallback(() => {
    if (!emblaApi) return
    if (emblaApi.canScrollNext()) emblaApi.scrollNext()
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
      userInteractedRef.current = true
      emblaApi?.scrollTo(i)
    },
    [emblaApi],
  )

  // When the active flag toggles back on (user scrolled back to this article),
  // restore the remembered page if Embla isn't already there.
  useEffect(() => {
    if (!emblaApi || !active) return
    const desired = Math.min(initialPage, Math.max(0, pages.length - 1))
    if (emblaApi.selectedScrollSnap() !== desired) {
      emblaApi.scrollTo(desired, true)
    }
  }, [active, emblaApi, initialPage, pages.length])

  const view = (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <div ref={emblaRef} className="h-dvh overflow-hidden">
        <div className="flex h-dvh touch-pan-y">
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
