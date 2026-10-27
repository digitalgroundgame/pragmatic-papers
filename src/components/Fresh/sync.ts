"use client"

import { getClientURL } from "@/utilities/getURL"

import { addSeen, seenNames, setOnMarkSeen } from "./store"

/**
 * The payload-preferences key a logged-in reader's seen names are kept under, as
 * `{ names: string[] }`. Preferences belong to the user, so this needs no schema of its own.
 */
export const SEEN_PREFERENCE_KEY = "fresh-seen"

const preferenceURL = (): string =>
  `${getClientURL()}/api/payload-preferences/${SEEN_PREFERENCE_KEY}`

/** The names in a stored preference, or none when it's missing or malformed. */
export function parseSeenPreference(value: unknown): string[] {
  const names = (value as { names?: unknown } | null | undefined)?.names
  return Array.isArray(names) ? names.filter((name) => typeof name === "string") : []
}

let linked = false
let running: Promise<void> | null = null
let again = false

/**
 * Merge what this browser has seen with the account's copy, both ways: names seen on the
 * account clear their dots here, and names seen here are added to the account. Read before
 * every write, so two browsers marking different names don't drop each other's.
 */
async function syncOnce(): Promise<void> {
  const response = await fetch(preferenceURL(), { credentials: "include" })
  if (!response.ok || !linked) return
  const body = (await response.json()) as { value?: unknown } | undefined
  const stored = parseSeenPreference(body?.value)
  addSeen(stored)
  const merged = [...new Set([...stored, ...(seenNames() ?? [])])]
  if (merged.length === stored.length) return
  await fetch(preferenceURL(), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: { names: merged } }),
  })
}

// One sync at a time; a name seen during one runs another after it, so it isn't lost.
function sync(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = syncOnce()
    .catch(() => undefined)
    .finally(() => {
      running = null
      if (again && linked) {
        again = false
        void sync()
      }
    })
  return running
}

/**
 * Someone is logged in: merge this browser's seen names with their account's, and keep the
 * account up to date as more are seen. Nothing is sent for readers who aren't logged in.
 */
export function linkSeenToAccount(): Promise<void> {
  linked = true
  setOnMarkSeen(() => void sync())
  return sync()
}

/** No one is logged in (any more): stop sending seen names. This browser keeps its own. */
export function unlinkSeenFromAccount(): void {
  linked = false
  again = false
  setOnMarkSeen(null)
}
