"use client"

import { createContext, useContext, useEffect, useState } from "react"

import type { CommentNode } from "./tree"

/** Where a link into the comments points: one comment, or one branch on its own. */
export type CommentTarget = { kind: "comment" | "thread"; id: string } | null

const TARGET = /^#(comment|thread)-(.+)$/

export function parseTarget(hash: string): CommentTarget {
  const match = TARGET.exec(hash)
  return match
    ? { kind: match[1] as "comment" | "thread", id: decodeURIComponent(match[2]!) }
    : null
}

/** The page's hash, following it as it changes. Empty on the server and the first render. */
export function useHash(): string {
  const [hash, setHash] = useState("")
  useEffect(() => {
    const update = () => setHash(window.location.hash)
    update()
    window.addEventListener("hashchange", update)
    return () => window.removeEventListener("hashchange", update)
  }, [])
  return hash
}

/** How deep a branch goes, relative to the view, before "Continue this thread". */
export const CONTINUE_DEPTH = { narrow: 3, wide: 5 }

export interface ThreadNav {
  /** Replies below this many levels from the view's top give way to "Continue this thread". */
  continueDepth: number
  /** The comment a link points at and every comment above it, which must be open and shown. */
  path: ReadonlySet<string>
  /** The comment to highlight for a moment, after arriving on its link. */
  highlighted: string | null
}

export const ThreadNavContext = createContext<ThreadNav>({
  continueDepth: CONTINUE_DEPTH.wide,
  path: new Set(),
  highlighted: null,
})

export const useThreadNav = (): ThreadNav => useContext(ThreadNavContext)

/** Every node in a tree, by id, with the id of its parent node. */
export function indexTree(
  roots: CommentNode[],
): Map<string, { node: CommentNode; parent: string | null }> {
  const index = new Map<string, { node: CommentNode; parent: string | null }>()
  const walk = (nodes: CommentNode[], parent: string | null) => {
    for (const node of nodes) {
      const id = String(node.comment.id)
      index.set(id, { node, parent })
      walk(node.replies, id)
    }
  }
  walk(roots, null)
  return index
}

/** The ids from a comment up to its top-level comment, the comment first. */
export function pathTo(index: ReturnType<typeof indexTree>, id: string): string[] {
  const path: string[] = []
  for (let at: string | null = id; at !== null && index.has(at); at = index.get(at)!.parent) {
    path.push(at)
  }
  return path
}

/**
 * The comment a view is rooted at: a branch's own (`#thread-…`), or, for a link to a comment
 * nested deeper than the whole thread shows, the ancestor that brings it into reach. Null for
 * the whole thread.
 */
export function viewRoot(
  index: ReturnType<typeof indexTree>,
  target: CommentTarget,
  continueDepth: number,
): string | null {
  if (!target || !index.has(target.id)) return null
  if (target.kind === "thread") return target.id
  const path = pathTo(index, target.id)
  // `path` runs from the comment (deepest) up to its top-level comment (depth 0).
  const depth = path.length - 1
  if (depth <= continueDepth) return null
  return path[continueDepth] ?? null
}
