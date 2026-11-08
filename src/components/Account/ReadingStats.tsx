"use client"

import React, { useEffect, useState } from "react"

import type { MyReading } from "@/plugins/readingHistory"

export interface ReadingStatsProps {
  /** Payload's API route. */
  apiPath?: string
}

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`

/**
 * The signed-in reader's reading, from `/api/reading/mine`: what's kept about them, shown to
 * them. Renders nothing when it can't load (sign-in switched off, or the request failed).
 */
export const ReadingStats: React.FC<ReadingStatsProps> = ({ apiPath = "/api" }) => {
  const [reading, setReading] = useState<MyReading | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${apiPath}/reading/mine`, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as MyReading
        if (!cancelled && typeof body.articlesRead === "number") setReading(body)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [apiPath])

  if (!reading) return null

  const stats: Array<[string, string]> = [
    ["Articles read", plural(reading.articlesRead, "article", "articles")],
    ...(reading.volumesRead === null
      ? []
      : [["Volumes read", plural(reading.volumesRead, "volume", "volumes")] as [string, string]]),
    ["Days visited", plural(reading.daysVisited, "day", "days")],
    ["Current streak", plural(reading.currentStreak, "day", "days")],
    ["Longest streak", plural(reading.longestStreak, "day", "days")],
  ]

  return (
    <section className="space-y-3" aria-labelledby="reading-heading">
      <h2 id="reading-heading" className="text-lg font-semibold">
        Your reading
      </h2>
      <p className="text-muted-foreground text-sm">
        While you&apos;re signed in, we keep the articles you read to the end and the days you
        visit, for achievements. Deleting your account deletes them.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        {stats.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  )
}
