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
        count?: number
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      toast.success(
        `Scheduled ${data.count ?? "?"} newsletter campaign${data.count === 1 ? "" : "s"} in Listmonk.`,
      )
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
