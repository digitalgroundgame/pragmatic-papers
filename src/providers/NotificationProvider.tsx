"use client"

import React, { useCallback, useSyncExternalStore } from "react"

const KEY_PREFIX = "pp:"

interface NotificationState {
  seen: Set<string>
  lastVisited: Map<string, string>
}

const EMPTY_STATE: NotificationState = Object.freeze({
  seen: new Set<string>(),
  lastVisited: new Map<string, string>(),
})

// Module-level external store — no React state, no effects
let _state: NotificationState | null = null
const _listeners = new Set<() => void>()

function _notify(): void {
  _listeners.forEach((l) => l())
}

function _subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

function _readFromLocalStorage(): NotificationState {
  const seen = new Set<string>()
  const lastVisited = new Map<string, string>()

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(KEY_PREFIX)) continue

    if (key.startsWith(`${KEY_PREFIX}seen:`)) {
      seen.add(key.slice(`${KEY_PREFIX}seen:`.length))
    } else if (key.startsWith(`${KEY_PREFIX}lastVisited:`)) {
      const name = key.slice(`${KEY_PREFIX}lastVisited:`.length)
      lastVisited.set(name, localStorage.getItem(key) ?? "")
    }
  }

  return { seen, lastVisited }
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

export interface NotificationHookValue {
  visible: boolean
  markSeen: () => void
  getLastVisited: () => Date | null
  setLastVisited: () => void
  loaded: boolean
}

export function useNotification(name: string): NotificationHookValue {
  const state = useSyncExternalStore(_subscribe, _getSnapshot, _getServerSnapshot)

  const visible = !state.seen.has(name)

  const markSeen = useCallback((): void => {
    localStorage.setItem(`${KEY_PREFIX}seen:${name}`, "1")
    const current = _getSnapshot()
    _state = { ...current, seen: new Set(current.seen).add(name) }
    _notify()
  }, [name])

  const getLastVisited = useCallback((): Date | null => {
    const val = state.lastVisited.get(name)
    return val ? new Date(val) : null
  }, [name, state.lastVisited])

  const setLastVisited = useCallback((): void => {
    const now = new Date().toISOString()
    localStorage.setItem(`${KEY_PREFIX}lastVisited:${name}`, now)
    const current = _getSnapshot()
    _state = { ...current, lastVisited: new Map(current.lastVisited).set(name, now) }
    _notify()
  }, [name])

  return { visible, markSeen, getLastVisited, setLastVisited, loaded: true }
}

// Thin wrapper kept for layout composition
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  return <>{children}</>
}
