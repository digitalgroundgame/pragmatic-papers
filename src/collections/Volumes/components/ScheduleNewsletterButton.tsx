"use client"

import { Button, toast, useDocumentInfo } from "@payloadcms/ui"
import React, { useState } from "react"

export function ScheduleNewsletterButton(): React.ReactNode {
  const { id } = useDocumentInfo()
  const [loading, setLoading] = useState(false)

  // No ID → unsaved Volume → can't schedule yet.
  if (!id) {
    return (
      <div style={{ marginBottom: "1rem" }}>
        <Button buttonStyle="secondary" disabled>
          Schedule newsletter (save first)
        </Button>
      </div>
    )
  }

  const onClick = async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch(`/api/volumes/${id}/schedule-newsletter`, {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as {
        created?: number
        updated?: number
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const created = data.created ?? 0
      const updated = data.updated ?? 0
      const parts: string[] = []
      if (created > 0) parts.push(`scheduled ${created} new`)
      if (updated > 0) parts.push(`updated ${updated}`)
      const summary =
        parts.length > 0 ? parts.join(" and ") : "no changes — all campaigns are up to date"
      toast.success(`Newsletter: ${summary}.`)
    } catch (err) {
      toast.error(
        `Could not schedule newsletter: ${err instanceof Error ? err.message : "unknown"}`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      <Button buttonStyle="primary" disabled={loading} onClick={onClick}>
        {loading ? "Scheduling..." : "Schedule newsletter campaigns"}
      </Button>
    </div>
  )
}
