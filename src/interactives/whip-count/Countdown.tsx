"use client"

import React, { useSyncExternalStore } from "react"

import { nextUpdate, type WhipCountUpdates } from "./model"

/** The current second, shared by every clock on the page, ticking only while one is shown. */
function subscribe(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, 1000)
  return () => window.clearInterval(timer)
}
const thisSecond = (): number => Math.floor(Date.now() / 1000)

const two = (n: number): string => String(n).padStart(2, "0")

/**
 * A clock counting down to the vote. It draws nothing on the server, where "now" would be
 * the time the page was rendered or cached, and nothing once the time has passed.
 */
export function Countdown({ to }: { to: string }): React.ReactNode {
  const now = useSyncExternalStore(subscribe, thisSecond, () => null)
  const target = Math.floor(Date.parse(to) / 1000)
  if (now === null || Number.isNaN(target) || target <= now) return null

  const left = target - now
  const parts: [number, string][] = [
    [Math.floor(left / 86400), "days"],
    [Math.floor((left % 86400) / 3600), "hours"],
    [Math.floor((left % 3600) / 60), "minutes"],
    [left % 60, "seconds"],
  ]
  return (
    <div data-whip-count-countdown="">
      <p className="text-muted-foreground text-center text-xs font-medium tracking-widest uppercase">
        Until the vote
      </p>
      {/* Not a live region: a clock announced every second would drown the page out. */}
      <p className="mt-1.5 flex justify-center gap-4 sm:gap-6" role="timer">
        {parts.map(([value, unit], i) => (
          <span key={unit} className="text-center">
            <span className="block font-sans text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
              {i === 0 ? value : two(value)}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">{unit}</span>
          </span>
        ))}
      </p>
    </div>
  )
}

/**
 * When the count is next checked for new statements, in the reader's own time. Drawn after
 * the page loads, like the clock, since the server doesn't know the reader's zone or the time
 * a cached page is read.
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
  const next = now === null ? null : nextUpdate(new Date(now * 1000), updates)
  if (!next || (voteAt && Date.parse(voteAt) <= now! * 1000)) return null
  const today = new Date(now! * 1000).toDateString() === next.toDateString()
  const time = next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return (
    <p data-whip-count-next-update="" className="text-muted-foreground mt-1 text-xs">
      Next check for new statements: {today ? "today" : "tomorrow"} at{" "}
      <time dateTime={next.toISOString()}>{time}</time>
    </p>
  )
}
