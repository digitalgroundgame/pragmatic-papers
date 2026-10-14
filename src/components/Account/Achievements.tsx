"use client"

import React, { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import type { HeldAchievement, MyAchievements } from "@/plugins/achievements"

export interface AchievementsProps {
  /** Payload's API route. */
  apiPath?: string
}

/**
 * The signed-in reader's achievements, from `/api/achievements/mine`. Renders nothing while
 * achievements are switched off (the endpoint answers 404) or the list can't load: it's extra.
 */
export const Achievements: React.FC<AchievementsProps> = ({ apiPath = "/api" }) => {
  const [held, setHeld] = useState<HeldAchievement[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${apiPath}/achievements/mine`, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as Partial<MyAchievements>
        if (!cancelled && Array.isArray(body.achievements)) setHeld(body.achievements)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [apiPath])

  if (!held) return null

  return (
    <section className="space-y-3" aria-labelledby="achievements-heading">
      <h2 id="achievements-heading" className="text-lg font-semibold">
        Achievements
      </h2>
      {held.length ? (
        <>
          <p className="text-muted-foreground text-sm">
            The first with a badge shows beside your name on your comments, unless you&apos;re
            staff.
          </p>
          <ul className="space-y-3">
            {held.map((achievement) => (
              <li key={achievement.key} className="space-y-1">
                <Badge variant="secondary">{achievement.label}</Badge>
                <p className="text-sm">{achievement.description}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">You haven&apos;t earned any yet.</p>
      )}
    </section>
  )
}
