"use client"

import { Button, toast } from "@payloadcms/ui"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import React, { useState } from "react"

import "./SyncNowButton.scss"

interface SyncResponse {
  jobId?: string | number
  result?: unknown
}

interface SyncCounts {
  synced: number
  unchanged: number
  skipped: number
  failed: number
}

/** The task output as `jobs.run` reports it; the shape varies by Payload version, so read defensively. */
function readCounts(result: unknown): SyncCounts | null {
  const seen = new Set<unknown>()
  const walk = (v: unknown): SyncCounts | null => {
    if (typeof v !== "object" || v === null || seen.has(v)) return null
    seen.add(v)
    const o = v as Record<string, unknown>
    if (["synced", "unchanged", "skipped", "failed"].every((k) => typeof o[k] === "number")) {
      return o as unknown as SyncCounts
    }
    for (const child of Object.values(o)) {
      const found = walk(child)
      if (found) return found
    }
    return null
  }
  return walk(result)
}

/**
 * Runs the interactive data sync on demand, above the snapshots list.
 *
 * The daily schedule covers the ordinary case; this is for the editor who has just been told
 * the researcher pushed new data and wants the draft snapshot to review now. Mirrors
 * `collections/Merch/components/SyncNowButton`.
 */
export function SyncNowButton(): React.ReactNode {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onClick = async (): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch("/api/interactive-snapshots/sync", {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as SyncResponse
      const output = readCounts(data.result)
      if (output) {
        const { synced, unchanged, skipped, failed } = output
        if (failed > 0)
          toast.error(
            `Sync finished with ${failed} failed feed${failed === 1 ? "" : "s"} — see the server log.`,
          )
        else if (synced > 0)
          toast.success(
            `Synced ${synced} feed${synced === 1 ? "" : "s"} — new draft snapshot${synced === 1 ? "" : "s"} to review.`,
          )
        else if (skipped > 0 && unchanged === 0)
          toast.warning("Nothing synced: every feed was skipped (token not set, or feed disabled).")
        else toast.info("Every feed is already up to date.")
      } else {
        toast.success("Sync ran.")
      }
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
        icon={
          <RefreshCw
            size={13}
            className={loading ? "interactiveSyncSpinner" : undefined}
            aria-hidden
          />
        }
        iconPosition="left"
        iconStyle="none"
      >
        {loading ? "Syncing..." : "Sync data feeds"}
      </Button>
    </div>
  )
}
