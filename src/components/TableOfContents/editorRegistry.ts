import type { LexicalEditor } from "@payloadcms/richtext-lexical/lexical"
import { useSyncExternalStore } from "react"

/**
 * The open document's editors, by field path, so a sidebar field can write
 * into the rich text it describes. `TableOfContentsLabelsFeature` registers
 * each editor it's in, and unregisters it when the editor unmounts.
 *
 * Each path keeps a stack: a document opened in a drawer (a doc's parent, say)
 * has a `content` editor of its own, which takes the path while it's open and
 * hands it back to the page's editor when the drawer closes.
 */
const editors = new Map<string, LexicalEditor[]>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function registerEditor(path: string, editor: LexicalEditor): () => void {
  editors.set(path, [...(editors.get(path) ?? []), editor])
  notify()
  return () => {
    const rest = (editors.get(path) ?? []).filter((registered) => registered !== editor)
    if (rest.length > 0) editors.set(path, rest)
    else editors.delete(path)
    notify()
  }
}

export function getRegisteredEditor(path: string): LexicalEditor | undefined {
  return editors.get(path)?.at(-1)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useRegisteredEditor(path: string): LexicalEditor | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getRegisteredEditor(path),
    () => undefined,
  )
}
