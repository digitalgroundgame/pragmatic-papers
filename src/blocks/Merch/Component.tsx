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
      rel="noopener"
      className="group flex flex-col gap-2 no-underline"
    >
      {/* The plate behind the product shot. `bg-muted` is oklch(0.97) — near
          enough to white that a white garment lost its edges against it, and
          most of the catalogue is white garments. `foreground/10` sits just
          past the card's own border value, dark enough to hold a white product
          without turning the plate into a colour of its own. Light theme only:
          the dark theme's plate is already darker than anything on it. */}
      <div className="bg-foreground/10 dark:bg-muted relative aspect-square overflow-hidden rounded-sm border">
        {isMedia(product.image) ? (
          <Media
            media={product.image}
            variant="square"
            sizes={imageSizesByLayout[layout]}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        {product.badge ? (
          <Badge className="absolute top-2 left-2 shadow-sm">{product.badge}</Badge>
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
  const { autoplay, heading, layout } = block
  const items = await getMerchProducts(block)
  const merchLayout = layout === "square" ? "square" : "fullWidth"
  // No heading is a real choice, not a gap to paper over — a placement inside a
  // rich-text column usually has the surrounding copy introducing it already.
  // Blank-but-present counts as unset, so a cleared field behaves like an
  // untouched one.
  const headingText = heading?.trim() ? heading : null
  const store = getMerchStoreUrl()

  if (items.length === 0) return null

  return (
    <>
      <section
        aria-label={headingText ?? undefined}
        className={cn(sectionVariants({ gutter: enableGutter }), className)}
      >
        <MerchCarousel autoplay={autoplay} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {headingText ? <h3>{headingText}</h3> : null}
            <div
              className={cn(
                "flex w-full items-center justify-between gap-3 sm:w-fit",
                // Without a heading there's nothing for `justify-between` to
                // push against, so keep the controls on the right themselves.
                !headingText && "sm:ml-auto",
              )}
            >
              {store && (
                <LinkButton
                  href={withMerchUtm(store, `${merchLayout}_shop_all`)}
                  target="_blank"
                  rel="noopener"
                  variant="branded"
                >
                  <ShoppingCart />
                  Shop all
                </LinkButton>
              )}
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
      {enableGutter && (
        <div className="container mb-9 last:hidden md:mb-12">
          <Separator />
        </div>
      )}
    </>
  )
}
