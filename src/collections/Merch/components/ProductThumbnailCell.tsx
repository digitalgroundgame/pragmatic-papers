"use client"

import { useConfig } from "@payloadcms/ui"
import { formatAdminURL } from "@payloadcms/ui/shared"
import Link from "next/link"
import React from "react"

interface ProductThumbnailCellProps {
  cellData?: string | null
  /** Payload sets this on the one column that opens the document. */
  link?: boolean
  /** Pre-computed destination, when Payload has one. */
  linkURL?: string
  collectionSlug?: string
  rowData?: { id?: number | string }
}

/**
 * Renders the product shot in the Merch list view.
 *
 * Product images live on Shopify's CDN rather than in our Media library, so
 * there's no upload thumbnail for Payload to show. A plain `img` is right here:
 * this is the admin, the URL is remote and already CDN-served, and `next/image`
 * would put the optimizer in front of a 40px thumbnail for nothing.
 *
 * A custom `Cell` replaces Payload's `DefaultCell` outright, including the link
 * that opens the document — so this reproduces it. Payload marks exactly one
 * column as the linked one and passes that down as `link`, which means the row
 * stays clickable no matter which column an editor drags into first place.
 */
export function ProductThumbnailCell({
  cellData,
  link,
  linkURL,
  collectionSlug,
  rowData,
}: ProductThumbnailCellProps): React.ReactNode {
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()

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

  if (!link) return thumbnail

  // Same fallback DefaultCell uses: Payload only passes `linkURL` when it has
  // one to override with, and otherwise builds the path itself.
  const href =
    linkURL ??
    (collectionSlug && rowData?.id != null
      ? formatAdminURL({
          adminRoute,
          path: `/collections/${collectionSlug}/${encodeURIComponent(String(rowData.id))}`,
        })
      : undefined)

  if (!href) return thumbnail

  return (
    <Link href={href} prefetch={false} style={{ display: "block" }}>
      {thumbnail}
    </Link>
  )
}
