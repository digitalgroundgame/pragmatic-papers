"use client"

import Autoplay from "embla-carousel-autoplay"
import React from "react"

import { Carousel } from "@/components/ui/carousel"

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
      // Autoplay that dead-ends at the last slide reads as broken, so cycle.
      opts={{ align: "start", containScroll: "trimSnaps", loop: isAutoplaying }}
      plugins={plugins}
      className={className}
    >
      {children}
    </Carousel>
  )
}
