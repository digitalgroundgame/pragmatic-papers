"use client"

import { useDocumentInfo } from "@payloadcms/ui"
import React, { useEffect, useState } from "react"

interface MediaReference {
  collection: string
  field: string
  docId: number | string
  docTitle: string
  docSlug?: string
}

interface ReferencesResponse {
  references: MediaReference[]
}

function collectionUrl(collection: string, docId: number | string): string {
  return `/admin/collections/${collection}/${docId}`
}

function collectionLabel(collection: string): string {
  return collection.charAt(0).toUpperCase() + collection.slice(1)
}

export function ReferencesView(): React.ReactNode {
  const { id } = useDocumentInfo()
  const [refs, setRefs] = useState<MediaReference[]>([])
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
        if (!cancelled) setRefs(data.references)
      })
      .catch(() => {
        if (!cancelled) setRefs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return null

  if (loading) {
    return (
      <div style={{ marginBottom: "1rem" }}>
        <p style={{ color: "var(--theme-text)", fontSize: "0.875rem", margin: 0 }}>
          Checking references…
        </p>
      </div>
    )
  }

  if (refs.length === 0) {
    return (
      <div
        style={{
          border: "1px solid var(--theme-elevation-200)",
          borderRadius: "4px",
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
        }}
      >
        <p style={{ color: "var(--theme-text)", fontSize: "0.875rem", margin: 0 }}>
          Not referenced in any published documents.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ color: "var(--theme-elevation-500)", fontSize: "1rem", margin: "0 0 0.75rem" }}>
        This media is referenced by the following published documents. You cannot delete it while it
        remains in use.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {refs.map((ref, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--theme-elevation-200)",
              backgroundColor: "var(--theme-elevation-50)",
              borderRadius: "4px",
              padding: "0.5rem 0.75rem",
            }}
          >
            <a
              href={collectionUrl(ref.collection, ref.docId)}
              style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "underline",
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ref.docTitle}
            </a>
            <span
              style={{
                color: "var(--theme-elevation-500)",
                fontSize: "0.8125rem",
                marginLeft: "0.5rem",
              }}
            >
              {collectionLabel(ref.collection)} &mdash; {ref.field}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
