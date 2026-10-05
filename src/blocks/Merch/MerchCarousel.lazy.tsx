"use client"
import dynamic from "next/dynamic"

// The carousel (embla) loads only on pages with a merch block.
export const MerchCarousel = dynamic(() => import("./MerchCarousel").then((m) => m.MerchCarousel))
export const MerchCarouselControls = dynamic(() =>
  import("./MerchCarousel").then((m) => m.MerchCarouselControls),
)
export const MerchCarouselDots = dynamic(() =>
  import("./MerchCarousel").then((m) => m.MerchCarouselDots),
)
