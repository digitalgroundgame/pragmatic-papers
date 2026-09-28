"use client"

import Link from "next/link"
import React from "react"

import { type DocumentHrefArgs, useDocumentHref } from "./useDocumentHref"

interface ProductTitleCellProps {
  cellData?: string | null
  linkURL?: string
  collectionSlug?: string
  rowData?: { id?: number | string }
  viewType?: DocumentHrefArgs["viewType"]
}

/**
 * The product title, always a link to the product.
 *
 * Payload links exactly one cell per row — the first active column — which
 * leaves the title inert whenever anything else leads. The title is what an
 * editor reads and reaches for, so it opens the document from wherever it sits.
 * Payload's own `link` prop is deliberately ignored: honouring it would put the
 * behaviour back at the mercy of column order.
 */
export function ProductTitleCell({
  cellData,
  linkURL,
  collectionSlug,
  rowData,
  viewType,
}: ProductTitleCellProps): React.ReactNode {
  const href = useDocumentHref({ linkURL, collectionSlug, rowData, viewType })

  if (!href) return <span>{cellData}</span>

  return (
    <Link href={href} prefetch={false}>
      {cellData}
    </Link>
  )
}
