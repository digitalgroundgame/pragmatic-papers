"use client"
import type { MerchBlock } from "@/payload-types"
import { useRowLabel } from "@payloadcms/ui"

/**
 * The products array is collapsed by default, so without this every row reads
 * "Product 01" and editors have to expand each one to find what they're
 * curating. Show the title (and price, when set) instead.
 */
export const ProductRowLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<NonNullable<MerchBlock["products"]>[number]>()

  const position = rowNumber === undefined ? "" : `${rowNumber + 1}. `
  const title = data?.title?.trim()

  if (!title) return <div>{`${position}New product`}</div>

  const price = data?.price?.trim()

  return <div>{price ? `${position}${title} — ${price}` : `${position}${title}`}</div>
}
