"use client"

import { useDocumentInfo } from "@payloadcms/ui"

import { DeletionNoticeBanner } from "./DeletionNoticeBanner"
import { useMediaReferences } from "./useMediaReferences"

export function DeletionNotice(): React.ReactNode {
  const { id } = useDocumentInfo()
  const { references, loading } = useMediaReferences(id)

  if (id == null || loading) return null
  return <DeletionNoticeBanner count={references.length} />
}
