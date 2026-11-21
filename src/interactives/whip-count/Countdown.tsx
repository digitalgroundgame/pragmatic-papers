"use client"

import React, { useSyncExternalStore } from "react"

import { cn } from "@/utilities/utils"

import { nextUpdate, type WhipCountUpdates } from "./model"

/** The current second, shared by every clock on the page, ticking only while one is shown. */
function subscribe(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, 1000)
  return () => window.clearInterval(timer)
}
const thisSecond = (): number => Math.floor(Date.now() / 1000)

const two = (n: number): string => String(n).padStart(2, "0")

const UNITS = ["days", "hours", "minutes", "seconds"] as const

/**
 * A clock counting down to the vote. "Now" is only known in the browser (on the server it
 * would be the time the page was rendered or cached), so the server draws the clock's frame
 * with hidden digits, the same size, and the browser fills them in without moving anything
 * below it. Nothing is drawn once the time has passed.
 */
export function Countdown({ to }: { to: string }): React.ReactNode {
  const now = useSyncExternalStore(subscribe, thisSecond, () => null)
  const target = Math.floor(Date.parse(to) / 1000)
  if (Number.isNaN(target) || (now !== null && target <= now)) return null

  const left = now === null ? null : target - now
  const values =
    left === null
      ? null
      : [
          Math.floor(left / 86400),
          Math.floor((left % 86400) / 3600),
          Math.floor((left % 3600) / 60),
          left % 60,
        ]
  return (
    <div data-whip-count-countdown="" aria-hidden={values === null ? true : undefined}>
      <p className="text-muted-foreground text-center text-xs font-medium tracking-widest uppercase">
        Until the vote
      </p>
      {/* Not a live region: a clock announced every second would drown the page out. */}
      <p
        className="mt-1.5 flex justify-center gap-4 sm:gap-6"
        role={values === null ? undefined : "timer"}
      >
        {UNITS.map((unit, i) => (
          <span key={unit} className="text-center">
            <span
              className={cn(
                "block font-sans text-2xl leading-none font-semibold tabular-nums sm:text-3xl",
                values === null && "invisible",
              )}
            >
              {values === null ? "00" : i === 0 ? values[i] : two(values[i]!)}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">{unit}</span>
          </span>
        ))}
      </p>
    </div>
  )
}

/**
 * When the count is next checked for new statements, in the reader's own time. Filled in after
 * the page loads, like the clock, since the server doesn't know the reader's zone or the time
 * a cached page is read; until then the line holds its place with hidden text, so the page
 * doesn't move when it appears.
 */
export function NextUpdate({
  updates,
  voteAt,
}: {
  updates: WhipCountUpdates
  /** Once the vote has passed there is nothing left to check for, so the line goes. */
  voteAt?: string
}): React.ReactNode {
  const now = useSyncExternalStore(subscribe, thisSecond, () => null)
  if (now === null) {
    return (
      <p data-whip-count-next-update="" aria-hidden className="text-muted-foreground mt-1 text-xs">
        <span className="invisible">Next check for new statements: today at 00:00 AM</span>
      </p>
    )
  }
  const next = nextUpdate(new Date(now * 1000), updates)
  if (!next || (voteAt && Date.parse(voteAt) <= now * 1000)) return null
  const today = new Date(now * 1000).toDateString() === next.toDateString()
  const time = next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return (
    <p data-whip-count-next-update="" className="text-muted-foreground mt-1 text-xs">
      Next check for new statements: {today ? "today" : "tomorrow"} at{" "}
      <time dateTime={next.toISOString()}>{time}</time>
    </p>
  )
}
