"use client"

import { useCallback, useRef } from "react"

export function usePageMemory(initial?: Iterable<readonly [number, number]>): {
  get: (articleId: number) => number
  set: (articleId: number, pageIndex: number) => void
} {
  const memory = useRef<Map<number, number> | null>(null)
  if (memory.current === null) {
    memory.current = new Map<number, number>(initial)
  }

  const get = useCallback((articleId: number) => memory.current!.get(articleId) ?? 0, [])

  const set = useCallback((articleId: number, pageIndex: number) => {
    memory.current!.set(articleId, pageIndex)
  }, [])

  return { get, set }
}
