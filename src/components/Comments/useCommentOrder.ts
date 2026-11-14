"use client"

import { useEffect, useState } from "react"

import { type CommentSort, DEFAULT_SORT, isCommentSort } from "./tree"

export const SORT_KEY = "pp-comments-sort"
export const SEED_KEY = "pp-comments-seed"

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private windows and full storage: the choice lasts until the page closes.
  }
}

/**
 * The order the reader keeps comments in, and the seed their random order shuffles by. Both
 * live in the browser, so the article page stays one cached copy for everyone. The seed is
 * made once, so a reader who comes back finds comments where they left them.
 */
export function useCommentOrder(): {
  sort: CommentSort
  setSort: (sort: CommentSort) => void
  seed: string
} {
  const [sort, setSortState] = useState<CommentSort>(DEFAULT_SORT)
  const [seed, setSeed] = useState("")

  useEffect(() => {
    const saved = read(SORT_KEY)
    let kept = read(SEED_KEY)
    if (!kept) {
      kept = Math.random().toString(36).slice(2, 10)
      write(SEED_KEY, kept)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable on the client
    if (isCommentSort(saved)) setSortState(saved)
    setSeed(kept)
  }, [])

  const setSort = (next: CommentSort) => {
    setSortState(next)
    write(SORT_KEY, next)
  }

  return { sort, setSort, seed }
}
