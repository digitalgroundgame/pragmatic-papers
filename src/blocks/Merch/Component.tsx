import React from "react"

import type { MerchBlock as MerchBlockProps } from "@/payload-types"

import { cva } from "class-variance-authority"
import { ShoppingCart } from "lucide-react"

import { isMedia, Media } from "@/components/Media"
import { MerchCarousel, MerchCarouselControls, MerchCarouselDots } from "./MerchCarousel"
import { getMerchProducts, type MerchProduct } from "./products"
import { getMerchStoreUrl } from "./urls"
import { withMerchUtm } from "./utm"
import { Badge } from "@/components/ui/badge"
import { CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { Separator } from "@/components/ui/separator"
import { LinkButton } from "@/components/ui/link-button"
import { cn } from "@/utilities/utils"

// Payload `defaultValue`s only fill DB rows created through the admin UI. Keep
// a runtime fallback so the block still renders sensibly if used directly.
const DEFAULT_HEADING = "The Pragmatic Papers Store"

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

type MerchLayout = keyof typeof imageSizesByLayout

// The block renders in two places. As a page-layout block it owns its own
// gutter and closes with a rule that separates it from the next block. Inside a
// rich-text column it sits in a container that already has both, and the
// surrounding `prose` typography would otherwise restyle the card text.
const sectionVariants = cva("", {
  variants: {
    gutter: {
      true: "container mb-9 md:mb-12",
      false: "not-prose mb-6 font-sans",
    },
  },
  defaultVariants: {
    gutter: true,
  },
})

interface MerchCardProps {
  product: MerchProduct
  layout: MerchLayout
}

const MerchCard: React.FC<MerchCardProps> = ({ product, layout }) => {
  return (
    <a
      href={withMerchUtm(product.url, `${layout}_product`)}
      target="_blank"
      // DiGG is the parent org of The Pragmatic Papers, so this isn't a paid
      // placement (`sponsored`) and isn't an unendorsed link (`nofollow`).
      // `noreferrer` is left off too, so DiGG's analytics sees where the click
      // came from alongside the campaign params.
      rel="noopener"
      className="group flex flex-col gap-2 no-underline"
    >
      <div className="bg-muted relative aspect-square overflow-hidden rounded-sm border">
        {isMedia(product.image) ? (
          <Media
            media={product.image}
            variant="square"
            sizes={imageSizesByLayout[layout]}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        {product.badge ? (
          <Badge variant="secondary" className="absolute top-2 left-2 shadow-sm">
            {product.badge}
          </Badge>
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

interface MerchBlockComponentProps extends MerchBlockProps {
  className?: string
  /** Off for rich-text placements, which already sit inside a padded column. */
  enableGutter?: boolean
}

export const MerchBlock = async ({
  className,
  enableGutter = true,
  ...block
}: MerchBlockComponentProps): Promise<React.ReactNode> => {
  const { autoplay, heading, layout, storeUrl } = block
  const items = await getMerchProducts(block)
  const merchLayout = layout === "square" ? "square" : "fullWidth"
  const headingText = heading ?? DEFAULT_HEADING
  const store = storeUrl?.trim() ? storeUrl : getMerchStoreUrl()

  if (items.length === 0) return null

  return (
    <>
      <section
        aria-label={headingText}
        className={cn(sectionVariants({ gutter: enableGutter }), className)}
      >
        <MerchCarousel autoplay={autoplay} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3>{headingText}</h3>
            <div className="flex w-full items-center justify-between gap-3 sm:w-fit">
              <LinkButton
                href={withMerchUtm(store, `${merchLayout}_shop_all`)}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                variant="branded"
              >
                <ShoppingCart />
                Shop all
              </LinkButton>
              <MerchCarouselControls />
            </div>
          </div>

          <CarouselContent>
            {items.map((product) => (
              <CarouselItem key={product.id} className={slideVariants({ layout: merchLayout })}>
                <MerchCard product={product} layout={merchLayout} />
              </CarouselItem>
            ))}
          </CarouselContent>

          {merchLayout === "square" ? <MerchCarouselDots /> : null}
        </MerchCarousel>
      </section>
      {enableGutter ? (
        <div className="container mb-9 last:hidden md:mb-12">
          <Separator />
        </div>
      ) : null}
    </>
  )
}
