"use client"

import Link from "next/link"
import React from "react"

import { type DocumentHrefArgs, useDocumentHref } from "./useDocumentHref"

interface ProductThumbnailCellProps {
  cellData?: string | null
  /** Payload sets this on the one column it treats as the row's link. */
  link?: boolean
  linkURL?: string
  collectionSlug?: string
  rowData?: { id?: number | string }
  viewType?: DocumentHrefArgs["viewType"]
}

/**
 * Renders the product shot in the Merch list view.
 *
 * Product images live on Shopify's CDN rather than in our Media library, so
 * there's no upload thumbnail for Payload to show. A plain `img` is right here:
 * this is the admin, the URL is remote and already CDN-served, and `next/image`
 * would put the optimizer in front of a 40px thumbnail for nothing.
 *
 * Links only when Payload marks this the row's linked column, which is the
 * behaviour a first-column cell would otherwise have lost by being custom.
 */
export function ProductThumbnailCell({
  cellData,
  link,
  linkURL,
  collectionSlug,
  rowData,
  viewType,
}: ProductThumbnailCellProps): React.ReactNode {
  const href = useDocumentHref({ linkURL, collectionSlug, rowData, viewType })

  const thumbnail = cellData ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote admin thumbnail, see above
    <img
      src={cellData}
      alt=""
      loading="lazy"
      height={40}
      style={{ height: 40, width: 40, objectFit: "cover", borderRadius: 4, display: "block" }}
    />
  ) : (
    <span aria-label="No image">—</span>
  )

  if (!link || !href) return thumbnail

  return (
    <Link href={href} prefetch={false} style={{ display: "block" }}>
      {thumbnail}
    </Link>
  )
}
