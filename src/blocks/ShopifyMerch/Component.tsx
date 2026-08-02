import React from "react"

import type { ShopifyMerchBlock as ShopifyMerchBlockProps } from "@/payload-types"

import { isMedia, Media } from "@/components/Media"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

import { getMerchProducts, type MerchProduct } from "./products"

// Payload `defaultValue`s only fill DB rows created through the admin UI. Keep
// runtime fallbacks so the block still renders sensibly if used directly.
const DEFAULT_HEADING = "From the DiGG Store"
const DEFAULT_STORE_URL = "https://store.digitalgroundgame.org/"

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

export const ShopifyMerchBlock: React.FC<ShopifyMerchBlockProps> = ({
  heading,
  layout,
  storeUrl,
  products,
}) => {
  const items = getMerchProducts(products)
  const isSquare = layout === "square"
  const headingText = heading ?? DEFAULT_HEADING
  const store = storeUrl?.trim() ? storeUrl : DEFAULT_STORE_URL

  if (items.length === 0) return null

  // Square (sidebar) images render small; full-width images span a grid cell.
  const imageSizes = isSquare
    ? "(max-width: 768px) 50vw, 200px"
    : "(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 280px"

  return (
    <section
      aria-label={headingText}
      className={cn(
        "not-prose bg-card flex flex-col gap-4 rounded-sm border p-5 font-sans",
        isSquare ? "w-full" : "w-full",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="mt-0! text-base font-semibold tracking-tight">{headingText}</h3>
        <a
          href={store}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Shop all
        </a>
      </div>

      <div
        className={cn(
          "grid gap-4",
          isSquare ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        )}
      >
        {items.map((product) => (
          <MerchCard key={product.id} product={product} sizes={imageSizes} />
        ))}
      </div>

      <a
        href={store}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ size: "sm" }), "w-full no-underline")}
      >
        Visit the store
      </a>
    </section>
  )
}
