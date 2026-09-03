"use client"

import { useConfig } from "@payloadcms/ui"
import { formatAdminURL } from "@payloadcms/ui/shared"
import type { DefaultCellComponentProps } from "payload"

/**
 * The subset of a cell's props that says where the row points. `collectionSlug`
 * stays a plain string — it's a path segment here, not a lookup key, and the
 * cells receive it from Payload rather than naming a collection themselves.
 */
export interface DocumentHrefArgs {
  linkURL?: string
  collectionSlug?: string
  rowData?: { id?: number | string }
  viewType?: DefaultCellComponentProps["viewType"]
}

/**
 * The admin URL for the document a list row represents.
 *
 * A custom `Cell` replaces Payload's `DefaultCell` outright, link included, so
 * any cell that wants to open its document has to build the destination the way
 * `DefaultCell` does: prefer the `linkURL` Payload hands down, and otherwise
 * assemble the collection path itself — respecting the trash view, which lives
 * under its own route.
 *
 * Returns `undefined` when there's nothing to point at, so callers can render
 * the plain cell rather than a dead link.
 */
export function useDocumentHref({
  linkURL,
  collectionSlug,
  rowData,
  viewType,
}: DocumentHrefArgs): string | undefined {
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()

  if (linkURL) return linkURL
  if (!collectionSlug || rowData?.id == null) return undefined

  return formatAdminURL({
    adminRoute,
    path: `/collections/${collectionSlug}${viewType === "trash" ? "/trash" : ""}/${encodeURIComponent(String(rowData.id))}`,
  })
}
