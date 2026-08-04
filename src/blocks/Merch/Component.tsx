import React from "react"

import type { MerchBlock as MerchBlockProps } from "@/payload-types"

import { cva } from "class-variance-authority"
import { ShoppingCart } from "lucide-react"

import { isMedia, Media } from "@/components/Media"
import { MerchCarousel } from "./MerchCarousel"
import { getMerchProducts, type MerchProduct } from "./products"
import {
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Separator } from "@/components/ui/separator"
import { LinkButton } from "@/components/ui/link-button"

// Payload `defaultValue`s only fill DB rows created through the admin UI. Keep
// runtime fallbacks so the block still renders sensibly if used directly.
const DEFAULT_HEADING = "The Pragmatic Papers Store"
const DEFAULT_STORE_URL = "https://pragmaticpapers.org/store"

// How many products a slide has to make room for. Square sits in a narrow
// sidebar, so it stays one-up at every width; full width fans out with the
// viewport. `CarouselItem`'s own `basis-full` is the mobile baseline for both.
const slideVariants = cva("", {
  variants: {
    layout: {
      square: "",
      fullWidth: "sm:basis-1/2 md:basis-1/3 lg:basis-1/4",
    },
  },
  defaultVariants: {
    layout: "fullWidth",
  },
})

// Matching `sizes` hints, so the browser doesn't fetch a full-width image for a
// sidebar slot.
const imageSizesByLayout = {
  square: "(max-width: 768px) 90vw, 320px",
  fullWidth: "(max-width: 640px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 280px",
} as const

interface MerchCardProps {
  product: MerchProduct
  sizes: string
}

const MerchCard: React.FC<MerchCardProps> = ({ product, sizes }) => {
  return (
    <a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-2 no-underline"
    >
      <div className="bg-muted relative aspect-square overflow-hidden rounded-sm border">
        {isMedia(product.image) ? (
          <Media
            media={product.image}
            variant="square"
            sizes={sizes}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm leading-tight font-medium group-hover:underline">
          {product.title}
        </span>
        {product.price ? (
          <span className="text-muted-foreground text-sm whitespace-nowrap">{product.price}</span>
        ) : null}
      </div>
    </a>
  )
}

export const MerchBlock: React.FC<MerchBlockProps> = ({
  autoplay,
  heading,
  layout,
  storeUrl,
  products,
}) => {
  const items = getMerchProducts(products)
  const merchLayout = layout === "square" ? "square" : "fullWidth"
  const headingText = heading ?? DEFAULT_HEADING
  const store = storeUrl?.trim() ? storeUrl : DEFAULT_STORE_URL

  if (items.length === 0) return null

  return (
    <>
      <section aria-label={headingText} className="container mb-9 md:mb-12">
        <MerchCarousel autoplay={autoplay} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3>{headingText}</h3>
            <div className="flex w-full items-center justify-between gap-3 sm:w-fit">
              <LinkButton href={store} target="_blank" rel="noopener noreferrer" variant="branded">
                <ShoppingCart />
                Shop all
              </LinkButton>
              <div className="flex gap-2">
                {/* Pull the arrows out of their default overlay position and into
                  the header. The `active:` override matches the button's own
                  variant chain so tailwind-merge replaces it rather than
                  stacking (otherwise pressing an arrow jerks it upward). */}
                <CarouselPrevious className="static translate-y-0 active:not-aria-[haspopup]:translate-y-0" />
                <CarouselNext className="static translate-y-0 active:not-aria-[haspopup]:translate-y-0" />
              </div>
            </div>
          </div>

          <CarouselContent>
            {items.map((product) => (
              <CarouselItem key={product.id} className={slideVariants({ layout: merchLayout })}>
                <MerchCard product={product} sizes={imageSizesByLayout[merchLayout]} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </MerchCarousel>
      </section>
      <div className="container mb-9 last:hidden md:mb-12">
        <Separator />
      </div>
    </>
  )
}
