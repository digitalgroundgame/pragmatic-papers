"use client"

import { Button, toast } from "@payloadcms/ui"
import React, { useState } from "react"

export function RunNowField(): React.ReactNode {
  const [loading, setLoading] = useState(false)

  const onClick = async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch("/api/article-recommendations/run", {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { jobId?: string | number }
      toast.success(`Recommendations job ran (id ${data.jobId ?? "?"}). Refresh to see updates.`)
    } catch (err) {
      toast.error(`Failed to run: ${err instanceof Error ? err.message : "unknown"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      <Button buttonStyle="primary" disabled={loading} onClick={onClick}>
        {loading ? "Running..." : "Run recommendations now"}
      </Button>
    </div>
  )
}
