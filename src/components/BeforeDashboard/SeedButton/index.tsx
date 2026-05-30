"use client"

import { toast } from "@payloadcms/ui"
import { Loader } from "lucide-react"
import React, { Fragment, useCallback, useState } from "react"

import "./index.scss"

type SeedEvent =
  | { type: "progress"; message: string; step: number; total: number }
  | { type: "success" }
  | { type: "error"; message: string }

const SEED_TOAST_ID = "seed"

const Spinner = () => <Loader size={16} className="seedSpinner" />

async function* readSeedEvents(res: Response): AsyncGenerator<SeedEvent> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += value
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as SeedEvent
    }
  }
}

export const SeedButton: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      if (seeded) {
        toast.info("Database already seeded.")
        return
      }
      if (loading) {
        toast.info("Seeding already in progress.")
        return
      }
      if (error) {
        toast.error("An error occurred, please refresh and try again.")
        return
      }

      setLoading(true)
      toast(
        <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
          <Spinner />
          <span style={{ flex: 1 }}>Connecting...</span>
        </span>,
        { id: SEED_TOAST_ID, duration: Infinity },
      )

      try {
        const res = await fetch("/next/seed", { method: "POST", credentials: "include" })
        if (!res.ok || !res.body) throw new Error("Failed to connect to seed endpoint.")

        for await (const event of readSeedEvents(res)) {
          if (event.type === "progress") {
            toast(
              <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
                <Spinner />
                <span style={{ flex: 1 }}>{event.message}</span>
                <span style={{ opacity: 0.5, fontSize: "0.8em", whiteSpace: "nowrap" }}>
                  {event.step} of {event.total}
                </span>
              </span>,
              { id: SEED_TOAST_ID, duration: Infinity },
            )
          } else if (event.type === "success") {
            toast.success(
              <div>
                Database seeded! You can now{" "}
                <a target="_blank" href="/">
                  visit your website
                </a>
              </div>,
              { id: SEED_TOAST_ID, duration: 6000 },
            )
            setSeeded(true)
          } else if (event.type === "error") {
            toast.error(event.message, { id: SEED_TOAST_ID })
            setError(event.message)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(message, { id: SEED_TOAST_ID })
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [loading, seeded, error],
  )

  let message = ""
  if (loading) message = " (seeding...)"
  if (seeded) message = " (done!)"
  if (error) message = ` (error: ${error})`

  return (
    <Fragment>
      <button className="seedButton" onClick={handleClick}>
        Seed your database
      </button>
      {message}
    </Fragment>
  )
}
