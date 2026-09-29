"use client"

import { useDocumentInfo } from "@payloadcms/ui"

import type { MediaReference } from "../references/collectMediaReferences"
import { MediaReferenceList } from "./MediaReferenceList"
import { useMediaReferences } from "./useMediaReferences"

interface DetachResponse {
  references?: MediaReference[]
  error?: string
}

export function ReferencesView(): React.ReactNode {
  const { id } = useDocumentInfo()
  const { references, loading, setReferences } = useMediaReferences(id)

  if (id == null) return null

  const detach = async (reference: MediaReference): Promise<void> => {
    const res = await fetch(`/api/media/${id}/detach`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: reference.collection,
        docId: reference.docId,
        field: reference.field,
      }),
    })
    const body = (await res.json().catch(() => ({}))) as DetachResponse
    // A refused detach can still say where the media is used now.
    if (body.references) setReferences(body.references)
    if (!res.ok) throw new Error(body.error ?? `Detaching failed (HTTP ${res.status}).`)
  }

  return <MediaReferenceList references={references} loading={loading} onDetach={detach} />
}
