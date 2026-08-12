"use client"

import React from "react"

/**
 * Renders the product shot in the Merch list view.
 *
 * Product images live on Shopify's CDN rather than in our Media library, so
 * there's no upload thumbnail for Payload to show. A plain `img` is right here:
 * this is the admin, the URL is remote and already CDN-served, and `next/image`
 * would put the optimizer in front of a 40px thumbnail for nothing.
 */
export function ProductThumbnailCell({ cellData }: { cellData?: string | null }): React.ReactNode {
  if (!cellData) return <span aria-label="No image">—</span>

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote admin thumbnail, see above
    <img
      src={cellData}
      alt=""
      loading="lazy"
      height={40}
      style={{ height: 40, width: 40, objectFit: "cover", borderRadius: 4, display: "block" }}
    />
  )
}
