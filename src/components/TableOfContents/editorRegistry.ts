import type { LexicalEditor } from "@payloadcms/richtext-lexical/lexical"
import { useSyncExternalStore } from "react"

/**
 * The open document's editors, by field path, so a sidebar field can write
 * into the rich text it describes. `TableOfContentsLabelsFeature` registers
 * each editor it's in, and unregisters it when the editor remounts.
 */
const editors = new Map<string, LexicalEditor>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function registerEditor(path: string, editor: LexicalEditor): () => void {
  editors.set(path, editor)
  notify()
  return () => {
    if (editors.get(path) !== editor) return
    editors.delete(path)
    notify()
  }
}

export function getRegisteredEditor(path: string): LexicalEditor | undefined {
  return editors.get(path)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useRegisteredEditor(path: string): LexicalEditor | undefined {
  return useSyncExternalStore(
    subscribe,
    () => editors.get(path),
    () => undefined,
  )
}
