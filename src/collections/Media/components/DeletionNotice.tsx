"use client"

import { useDocumentInfo } from "@payloadcms/ui"
import { useEffect, useState } from "react"

interface MediaReference {
  docTitle: string
}

interface ReferencesResponse {
  references: MediaReference[]
}

export function DeletionNotice(): React.ReactNode {
  const { id } = useDocumentInfo()
  const [refCount, setRefCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    fetch(`/api/media/${id}/references`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ReferencesResponse>
      })
      .then((data) => {
        if (!cancelled) setRefCount(data.references.length)
      })
      .catch(() => {
        if (!cancelled) setRefCount(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (!id || loading || refCount === null || refCount === 0) return null

  return (
    <div
      style={{
        background: "var(--theme-warning-100)",
        border: "1px solid var(--theme-warning-500)",
        borderRadius: "4px",
        color: "var(--theme-warning-900)",
        fontSize: "0.8125rem",
        marginBottom: "0.75rem",
        padding: "0.5rem 0.75rem",
      }}
    >
      <strong>Deletion unavailable</strong>
      <br />
      Used in {refCount} published document{refCount === 1 ? "" : "s"}. See the References tab for
      details.
    </div>
  )
}
