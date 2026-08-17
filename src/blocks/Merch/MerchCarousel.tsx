"use client"

import Autoplay from "embla-carousel-autoplay"
import React from "react"

import {
  Carousel,
  CarouselIndicators,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "@/components/ui/carousel"

const AUTOPLAY_DELAY_MS = 6000

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Autoplay is motion the reader didn't ask for, so honour their OS setting.
 * Starts pessimistic (`true`) so nothing moves before the query is read.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(true)

  React.useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const sync = () => setPrefersReducedMotion(query.matches)

    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  return prefersReducedMotion
}

interface MerchCarouselProps {
  autoplay?: boolean | null
  className?: string
  children: React.ReactNode
}

/**
 * Client seam for the Merch block. Embla plugins are live objects and can't
 * cross the server/client boundary, so the plugin is built here while the
 * slides themselves stay server-rendered and pass through as `children`.
 */
export const MerchCarousel: React.FC<MerchCarouselProps> = ({ autoplay, className, children }) => {
  const prefersReducedMotion = usePrefersReducedMotion()
  const isAutoplaying = Boolean(autoplay) && !prefersReducedMotion

  // A new array identity re-initialises embla, so only rebuild when the
  // effective autoplay state actually flips.
  const plugins = React.useMemo(
    () =>
      isAutoplaying
        ? [
            Autoplay({
              delay: AUTOPLAY_DELAY_MS,
              stopOnInteraction: true,
              stopOnMouseEnter: true,
              stopOnFocusIn: true,
            }),
          ]
        : [],
    [isAutoplaying],
  )

  return (
    <Carousel
      opts={{
        align: "start",
        containScroll: "trimSnaps",
        // Autoplay that dead-ends at the last slide reads as broken, so cycle.
        loop: isAutoplaying,
        // Page through, don't nudge: an arrow advances by however many
        // products the viewport is currently showing, so nothing the reader
        // just looked at is still on screen afterwards. `auto` reads that
        // count from the rendered layout, which is what keeps it in step with
        // the responsive slide widths (one up on mobile, four up on desktop)
        // instead of hard-coding a number per breakpoint.
        slidesToScroll: "auto",
      }}
      plugins={plugins}
      className={className}
    >
      {children}
    </Carousel>
  )
}

/**
 * Prev/next arrows that disappear when there's nothing to scroll — with four
 * products in a four-up layout, permanently disabled arrows imply content that
 * isn't there.
 */
export const MerchCarouselControls: React.FC = () => {
  const { canScrollPrev, canScrollNext } = useCarousel()

  if (!canScrollPrev && !canScrollNext) return null

  return (
    <div className="flex gap-2">
      {/* Pull the arrows out of their default overlay position and into the
          header. The `active:` override matches the button's own variant chain
          so tailwind-merge replaces it rather than stacking (otherwise pressing
          an arrow jerks it upward). */}
      <CarouselPrevious className="static translate-y-0 active:not-aria-[haspopup]:translate-y-0" />
      <CarouselNext className="static translate-y-0 active:not-aria-[haspopup]:translate-y-0" />
    </div>
  )
}

/**
 * Position dots for the one-up layouts, where nothing else tells the reader how
 * many products there are. Counts embla's snap points rather than the slides,
 * so a dot is one press of the arrow — which, with `slidesToScroll: "auto"`,
 * is a whole page of products at widths that show several at once.
 */
export const MerchCarouselDots: React.FC = () => {
  const { api } = useCarousel()
  const [snapCount, setSnapCount] = React.useState(0)
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (!api) return

    const sync = () => {
      setSnapCount(api.scrollSnapList().length)
      setCurrent(api.selectedScrollSnap())
    }

    React.startTransition(sync)
    api.on("select", sync)
    api.on("reInit", sync)

    return () => {
      api.off("select", sync)
      api.off("reInit", sync)
    }
  }, [api])

  // A single snap point means everything already fits.
  if (snapCount < 2) return null

  return <CarouselIndicators count={snapCount} current={current} className="static" />
}
