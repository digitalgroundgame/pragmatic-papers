"use client"

import React, { useCallback, useSyncExternalStore } from "react"

const KEY_PREFIX = "pp:"
const SEEN_PREFIX = `${KEY_PREFIX}seen:`
const LAST_VISITED_PREFIX = `${KEY_PREFIX}lastVisited:`

interface NotificationState {
  seen: Set<string>
  lastVisited: Map<string, string>
  /** False on the server, and in browsers where localStorage can't be read. */
  hydrated: boolean
}

const EMPTY_STATE: NotificationState = Object.freeze({
  seen: new Set<string>(),
  lastVisited: new Map<string, string>(),
  hydrated: false,
})

// Module-level external store — no React state, no effects. One instance per tab,
// backed by localStorage. When Layer 2 syncs seen-state to Payload users, turn this
// into a factory, `createNotificationStore(storage)`, with one default instance, so
// the backend can be swapped (and tests get fresh instances instead of
// `resetNotificationStore`). useNotification's API shouldn't need to change.
let _state: NotificationState | null = null
const _listeners = new Set<() => void>()

function _notify(): void {
  _listeners.forEach((l) => l())
}

// Another tab wrote (or cleared) our keys: drop the cached state so the next
// snapshot re-reads localStorage.
function _onStorage(event: StorageEvent): void {
  if (event.key !== null && !event.key.startsWith(KEY_PREFIX)) return
  _state = null
  _notify()
}

function _subscribe(listener: () => void): () => void {
  if (_listeners.size === 0) window.addEventListener("storage", _onStorage)
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
    if (_listeners.size === 0) window.removeEventListener("storage", _onStorage)
  }
}

// Private mode and blocked site data can make any localStorage access throw.
// Treat that as "no storage": nothing is hydrated, so no dot is shown.
function _readFromLocalStorage(): NotificationState {
  try {
    const seen = new Set<string>()
    const lastVisited = new Map<string, string>()

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(KEY_PREFIX)) continue

      if (key.startsWith(SEEN_PREFIX)) {
        seen.add(key.slice(SEEN_PREFIX.length))
      } else if (key.startsWith(LAST_VISITED_PREFIX)) {
        lastVisited.set(key.slice(LAST_VISITED_PREFIX.length), localStorage.getItem(key) ?? "")
      }
    }

    return { seen, lastVisited, hydrated: true }
  } catch {
    return EMPTY_STATE
  }
}

function _write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage is full or blocked; the in-memory state still updates for this page.
  }
}

function _getSnapshot(): NotificationState {
  if (_state === null) {
    _state = _readFromLocalStorage()
  }
  return _state
}

function _getServerSnapshot(): NotificationState {
  return EMPTY_STATE
}

/** Forget the cached state so the next read comes from localStorage. For tests. */
export function resetNotificationStore(): void {
  _state = null
  _notify()
}

export interface NotificationHookValue {
  visible: boolean
  markSeen: () => void
  getLastVisited: () => Date | null
  setLastVisited: () => void
  loaded: boolean
}

export function useNotification(name: string): NotificationHookValue {
  const state = useSyncExternalStore(_subscribe, _getSnapshot, _getServerSnapshot)

  const visible = state.hydrated && !state.seen.has(name)

  const markSeen = useCallback((): void => {
    const current = _getSnapshot()
    if (current.seen.has(name)) return
    _write(`${SEEN_PREFIX}${name}`, "1")
    _state = { ...current, seen: new Set(current.seen).add(name) }
    _notify()
  }, [name])

  const getLastVisited = useCallback((): Date | null => {
    const val = state.lastVisited.get(name)
    if (!val) return null
    const date = new Date(val)
    return Number.isNaN(date.getTime()) ? null : date
  }, [name, state.lastVisited])

  const setLastVisited = useCallback((): void => {
    const now = new Date().toISOString()
    _write(`${LAST_VISITED_PREFIX}${name}`, now)
    const current = _getSnapshot()
    _state = { ...current, lastVisited: new Map(current.lastVisited).set(name, now) }
    _notify()
  }, [name])

  return { visible, markSeen, getLastVisited, setLastVisited, loaded: state.hydrated }
}

// Thin wrapper kept for layout composition
export function NotificationProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  return <>{children}</>
}
