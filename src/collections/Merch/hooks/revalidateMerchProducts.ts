import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidateTag } from "next/cache"

import type { Merch as MerchProductDoc } from "@/payload-types"

import { MERCH_TAG } from "../tag"

/**
 * Merch blocks are rendered into statically generated pages, so an editorial
 * change (featuring a product, hiding one, overriding a badge) only reaches
 * readers once the cached product query is dropped.
 *
 * The sync job revalidates this same tag, but only when a run actually changed
 * something — see `src/jobs/syncShopifyProducts/index.ts`.
 */

export const revalidateMerchProduct: CollectionAfterChangeHook<MerchProductDoc> = ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) revalidateTag(MERCH_TAG, "max")
  return doc
}

export const revalidateMerchProductDelete: CollectionAfterDeleteHook<MerchProductDoc> = ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) revalidateTag(MERCH_TAG, "max")
  return doc
}
