"use client"

import { useCallback, useRef } from "react"

export function usePageMemory(): {
  get: (articleId: number) => number
  set: (articleId: number, pageIndex: number) => void
} {
  const memory = useRef(new Map<number, number>())

  const get = useCallback((articleId: number) => memory.current.get(articleId) ?? 0, [])

  const set = useCallback((articleId: number, pageIndex: number) => {
    memory.current.set(articleId, pageIndex)
  }, [])

  return { get, set }
}
