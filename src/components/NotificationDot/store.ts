"use client"

import { useSyncExternalStore } from "react"

/** A dot's name is stored under this prefix once the reader has seen it, e.g. `notification-dot:mode-toggle`. */
export const SEEN_KEY_PREFIX = "notification-dot:"

/** The names of the dots this reader has seen, or null when localStorage can't be read. */
type Seen = ReadonlySet<string> | null

// One store per tab, backed by localStorage. When Layer 2 syncs seen dots to Payload
// users, turn this module into a factory, `createSeenStore(storage)`, with one default
// instance, so the backend can be swapped (and tests get fresh instances instead of
// `resetSeenStore`). useNotificationDot's API shouldn't need to change.
let seen: Seen | undefined
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

// Private mode and blocked site data can make any localStorage access throw. Treat
// that as "unknown", so no dot is shown rather than one that can never be cleared.
function readSeen(): Seen {
  try {
    const names = new Set<string>()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(SEEN_KEY_PREFIX)) names.add(key.slice(SEEN_KEY_PREFIX.length))
    }
    return names
  } catch {
    return null
  }
}

// Another tab saw a dot (or cleared storage): re-read on the next snapshot.
function onStorage(event: StorageEvent): void {
  if (event.key !== null && !event.key.startsWith(SEEN_KEY_PREFIX)) return
  seen = undefined
  notify()
}

function subscribeToSeen(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener("storage", onStorage)
  }
}

function getSeen(): Seen {
  if (seen === undefined) seen = readSeen()
  return seen
}

/** Whether the dot called `name` should show: storage is readable and the reader hasn't seen it. */
export function useIsUnseen(name: string): boolean {
  const current = useSyncExternalStore(subscribeToSeen, getSeen, () => null)
  return current !== null && !current.has(name)
}

/** Record that the reader has seen the dot called `name`, in this tab and every other. */
export function markSeen(name: string): void {
  const current = getSeen()
  if (current?.has(name)) return
  try {
    localStorage.setItem(`${SEEN_KEY_PREFIX}${name}`, "1")
  } catch {
    // Storage is full or blocked; the dot still clears for this page.
  }
  seen = new Set(current).add(name)
  notify()
}

/** Forget the cached state so the next read comes from localStorage. For tests and stories. */
export function resetSeenStore(): void {
  seen = undefined
  notify()
}
