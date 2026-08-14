"use client"

import { Button, toast } from "@payloadcms/ui"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import React, { useState } from "react"

interface SyncResponse {
  jobId?: string | number
  /** False when the Shopify credentials aren't set, so the run was a no-op. */
  configured?: boolean
}

/**
 * Runs the Shopify sync on demand, above the products list.
 *
 * The scheduled job covers the ordinary case; this is for the editor who has
 * just pushed a drop and doesn't want to wait up to an hour to see it. Mirrors
 * `RunNowField` on the article-recommendations global.
 */
export function SyncNowButton(): React.ReactNode {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onClick = async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch("/api/merch/sync", { method: "POST", credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as SyncResponse

      if (data.configured === false) {
        // The job logs a warning and skips rather than failing, so without this
        // the button would report success while nothing happened.
        toast.warning("Shopify isn't configured here, so there was nothing to sync.")
        return
      }

      toast.success("Synced from Shopify.")
      // Pull the refreshed rows in rather than asking the editor to reload.
      router.refresh()
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      <Button
        buttonStyle="primary"
        disabled={loading}
        onClick={onClick}
        // Payload's built-in icon set is chevron/edit/plus/x, so the sync glyph
        // comes from lucide. `iconStyle="none"` drops the bordered-circle
        // treatment, which is sized for an icon-only button.
        icon={<RefreshCw size={15} aria-hidden />}
        iconPosition="left"
        iconStyle="none"
      >
        {loading ? "Syncing..." : "Sync Shopify"}
      </Button>
    </div>
  )
}
