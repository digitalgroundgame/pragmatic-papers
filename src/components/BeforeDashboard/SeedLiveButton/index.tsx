"use client"

import { toast } from "@payloadcms/ui"
import { Loader } from "lucide-react"
import React, { Fragment, useCallback, useState } from "react"

import "../SeedButton/index.scss"

type SeedLiveEvent =
  | { type: "progress"; message: string; step: number; total: number }
  | { type: "success" }
  | { type: "error"; message: string }

const SEED_LIVE_TOAST_ID = "seed-live"

const Spinner = () => <Loader size={16} className="seedSpinner" />

async function* readSeedLiveEvents(res: Response): AsyncGenerator<SeedLiveEvent> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += value
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as SeedLiveEvent
    }
  }
}

export const SeedLiveButton: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      if (loading) {
        toast.info("Import already in progress.")
        return
      }

      setLoading(true)
      setError(null)
      toast(
        <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
          <Spinner />
          <span style={{ flex: 1 }}>Connecting to live environment...</span>
        </span>,
        { id: SEED_LIVE_TOAST_ID, duration: Infinity },
      )

      try {
        const res = await fetch("/next/seed-live", { method: "POST", credentials: "include" })
        if (!res.ok || !res.body) throw new Error("Failed to connect to seed-live endpoint.")

        for await (const event of readSeedLiveEvents(res)) {
          if (event.type === "progress") {
            toast(
              <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
                <Spinner />
                <span style={{ flex: 1 }}>{event.message}</span>
                <span style={{ opacity: 0.5, fontSize: "0.8em", whiteSpace: "nowrap" }}>
                  {event.step} of {event.total}
                </span>
              </span>,
              { id: SEED_LIVE_TOAST_ID, duration: Infinity },
            )
          } else if (event.type === "success") {
            toast.success(
              <div>
                Live articles imported! You can now{" "}
                <a target="_blank" href="/">
                  visit your website
                </a>
              </div>,
              { id: SEED_LIVE_TOAST_ID, duration: 6000 },
            )
            setSeeded(true)
          } else if (event.type === "error") {
            toast.error(event.message, { id: SEED_LIVE_TOAST_ID })
            setError(event.message)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(message, { id: SEED_LIVE_TOAST_ID })
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [loading],
  )

  let message = ""
  if (loading) message = " (importing...)"
  if (seeded) message = " (done!)"
  if (error) message = ` (error: ${error})`

  return (
    <Fragment>
      <button className="seedButton" onClick={handleClick}>
        import live articles
      </button>
      {message}
    </Fragment>
  )
}
