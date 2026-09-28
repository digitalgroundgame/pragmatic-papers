"use client"

import { useEffect, useState } from "react"

import type { MediaReference } from "../references/collectMediaReferences"

interface ReferencesResponse {
  references: MediaReference[]
}

/**
 * How long a lookup is reused. The deletion notice and the References tab mount
 * moments apart on one media page, so they share a request; a later visit, after
 * content has changed, makes a new one.
 */
export const SHARED_FOR_MS = 30_000

const requests = new Map<string, { startedAt: number; references: Promise<MediaReference[]> }>()

function fetchReferences(id: string): Promise<MediaReference[]> {
  const cached = requests.get(id)
  if (cached && Date.now() - cached.startedAt < SHARED_FOR_MS) return cached.references

  const references = fetch(`/api/media/${id}/references`, { credentials: "include" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<ReferencesResponse>
    })
    .then((data) => data.references)
    .catch(() => {
      // Don't reuse a failure; the next component to ask tries again.
      requests.delete(id)
      return []
    })
  requests.set(id, { startedAt: Date.now(), references })
  return references
}

/** Fetches the published documents that use a media item; none if the request fails. */
export function useMediaReferences(id: number | string | undefined): {
  references: MediaReference[]
  loading: boolean
} {
  const [references, setReferences] = useState<MediaReference[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id == null) return
    let cancelled = false

    void fetchReferences(String(id)).then((refs) => {
      if (cancelled) return
      setReferences(refs)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [id])

  return { references, loading }
}
