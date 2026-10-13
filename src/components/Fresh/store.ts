"use client"

import { useSyncExternalStore } from "react"

/**
 * A fresh name is stored under this prefix once the reader has seen it, e.g.
 * `pp:seen:mode-toggle`. `pp:` keeps the site's own keys apart from the ones
 * libraries write, like the theme's `theme`.
 */
export const SEEN_KEY_PREFIX = "pp:seen:"

/** The names this reader has seen, or null when localStorage can't be read. */
type Seen = ReadonlySet<string> | null

// One store per tab, backed by localStorage. For someone logged in, `./sync` merges it with
// the copy kept on their account, so what they've seen follows them between browsers.
let seen: Seen | undefined
const listeners = new Set<() => void>()
// Told each time this tab marks a name seen, so the account's copy can catch up.
let onMarkSeen: ((name: string) => void) | null = null

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

// Another tab saw something (or cleared storage): re-read on the next snapshot.
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

/** Whether `name` is fresh: storage is readable and the reader hasn't seen it. */
export function useIsUnseen(name: string): boolean {
  const current = useSyncExternalStore(subscribeToSeen, getSeen, () => null)
  return current !== null && !current.has(name)
}

/** Record that the reader has seen `name`, in this tab and every other. */
export function markSeen(name: string): void {
  const current = getSeen()
  // Unreadable storage shows no dots, so there's nothing to clear. Recording `name`
  // here would turn "unknown" into "seen only this", and every other dot would appear.
  // Only an account (`addSeen`) can stand in for storage: its dots clear for good.
  if (current === null || current.has(name)) return
  try {
    localStorage.setItem(`${SEEN_KEY_PREFIX}${name}`, "1")
  } catch {
    // Storage is full or blocked; the dot still clears for this page.
  }
  seen = new Set(current).add(name)
  notify()
  onMarkSeen?.(name)
}

/** Every name this reader has seen, or null when localStorage can't be read. */
export function seenNames(): string[] | null {
  const current = getSeen()
  return current === null ? null : [...current]
}

/**
 * Record names seen somewhere else (on the reader's account), in this tab and every other.
 * Unlike `markSeen`, this doesn't tell the account: it's where they came from. When
 * localStorage can't be read, they're kept for this page and become what's known: dots the
 * account hasn't recorded show, and clearing one records it there.
 */
export function addSeen(names: Iterable<string>): void {
  const current = getSeen()
  const next = new Set(current ?? [])
  for (const name of names) {
    if (next.has(name)) continue
    next.add(name)
    try {
      localStorage.setItem(`${SEEN_KEY_PREFIX}${name}`, "1")
    } catch {
      // Storage is full or blocked; this page still knows.
    }
  }
  if (current !== null && next.size === current.size) return
  seen = next
  notify()
}

/** Call `listener` each time this tab marks a name seen, or stop with null. */
export function setOnMarkSeen(listener: ((name: string) => void) | null): void {
  onMarkSeen = listener
}

/** Forget the cached state so the next read comes from localStorage. For tests and stories. */
export function resetSeenStore(): void {
  seen = undefined
  notify()
}
