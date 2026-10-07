"use client"
import dynamic from "next/dynamic"

// The carousel (embla) loads only on pages with a merch block. Everything Component.tsx
// renders from `ui/carousel` comes through here: one static import of it would pull
// embla into every page that renders rich text.
export const MerchCarousel = dynamic(() => import("./MerchCarousel").then((m) => m.MerchCarousel))
export const MerchCarouselControls = dynamic(() =>
  import("./MerchCarousel").then((m) => m.MerchCarouselControls),
)
export const MerchCarouselDots = dynamic(() =>
  import("./MerchCarousel").then((m) => m.MerchCarouselDots),
)
export const CarouselContent = dynamic(() =>
  import("./MerchCarousel").then((m) => m.CarouselContent),
)
export const CarouselItem = dynamic(() => import("./MerchCarousel").then((m) => m.CarouselItem))
