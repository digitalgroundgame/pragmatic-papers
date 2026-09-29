"use client"

import { useEffect, useState } from "react"

import type { MediaReference } from "../references/collectMediaReferences"

interface ReferencesResponse {
  references: MediaReference[]
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

    fetch(`/api/media/${id}/references`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ReferencesResponse>
      })
      .then((data) => {
        if (!cancelled) setReferences(data.references)
      })
      .catch(() => {
        if (!cancelled) setReferences([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { references, loading }
}
