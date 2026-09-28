"use client"

import { useDocumentInfo } from "@payloadcms/ui"

import { MediaReferenceList } from "./MediaReferenceList"
import { useMediaReferences } from "./useMediaReferences"

export function ReferencesView(): React.ReactNode {
  const { id } = useDocumentInfo()
  const { references, loading } = useMediaReferences(id)

  if (id == null) return null
  return <MediaReferenceList references={references} loading={loading} />
}
