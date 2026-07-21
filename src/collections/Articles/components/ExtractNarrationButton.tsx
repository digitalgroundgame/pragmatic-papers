"use client"

import { Button, toast, useDocumentInfo, useFormFields } from "@payloadcms/ui"
import React, { useState, useSyncExternalStore } from "react"
import { extractNarrationText } from "@/utilities/extractNarrationText"

const noop = (): void => {
  // no-op for useSyncExternalStore
}
const emptySubscribe = (): (() => void) => noop
const getClientSnapshot = (): boolean => true
const getServerSnapshot = (): boolean => false

function useIsMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)
}

interface NarrationCacheEntry {
  text: string
  hasGenerated: boolean
}

const inMemoryNarrationCache = new Map<string, NarrationCacheEntry>()

export function resetNarrationCache(): void {
  inMemoryNarrationCache.clear()
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.clear()
    } catch {
      // ignore errors
    }
  }
}

function getNarrationCacheKey(id?: string | number): string {
  if (id !== undefined && id !== null && id !== "") {
    return `narration_text_${id}`
  }
  if (typeof window !== "undefined" && window.location?.pathname) {
    return `narration_text_path_${window.location.pathname}`
  }
  return "narration_text_default"
}

function getStoredNarration(key: string): NarrationCacheEntry | null {
  if (inMemoryNarrationCache.has(key)) {
    return inMemoryNarrationCache.get(key)!
  }
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored) as NarrationCacheEntry
        if (typeof parsed.text === "string" && typeof parsed.hasGenerated === "boolean") {
          inMemoryNarrationCache.set(key, parsed)
          return parsed
        }
      }
    } catch {
      // ignore parse or storage errors
    }
  }
  return null
}

function setStoredNarration(key: string, entry: NarrationCacheEntry): void {
  inMemoryNarrationCache.set(key, entry)
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(entry))
    } catch {
      // ignore storage errors
    }
  }
}

export function ExtractNarrationButton(): React.ReactNode {
  const isMounted = useIsMounted()
  const docInfo = useDocumentInfo()
  const docId = docInfo?.id
  const cacheKey = getNarrationCacheKey(docId)

  const [editableText, setEditableText] = useState(() => {
    const cached = getStoredNarration(cacheKey)
    return cached ? cached.text : ""
  })
  const [hasGenerated, setHasGenerated] = useState(() => {
    const cached = getStoredNarration(cacheKey)
    return cached ? cached.hasGenerated : false
  })

  const { title, authors, populatedAuthors, publishedAt, content } = useFormFields(([fields]) => ({
    title: fields.title?.value as string | undefined,
    authors: fields.authors?.value as Array<Record<string, unknown> | string | number> | undefined,
    populatedAuthors: fields.populatedAuthors?.value as Array<{ name?: string }> | undefined,
    publishedAt: fields.publishedAt?.value as string | Date | undefined,
    content: fields.content?.value as Record<string, unknown> | undefined,
  }))

  const handleGenerate = (): void => {
    const text = extractNarrationText({
      title,
      authors,
      populatedAuthors,
      publishedAt,
      content,
    })
    const isRegenerating = hasGenerated
    setEditableText(text)
    setHasGenerated(true)
    setStoredNarration(cacheKey, { text, hasGenerated: true })
    toast.success(isRegenerating ? "Narration text regenerated!" : "Narration text generated!")
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const text = e.target.value
    setEditableText(text)
    setStoredNarration(cacheKey, { text, hasGenerated: true })
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(editableText)
      toast.success("Narration text copied to clipboard!")
    } catch (err) {
      toast.error(
        `Failed to copy narration text to clipboard: ${err instanceof Error ? err.message : "Unknown error"}`,
      )
    }
  }

  if (!isMounted) {
    return (
      <div style={{ padding: "1rem 0" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8 }}>Loading narration tools...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: "1rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>Narration Plain Text</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8 }}>
            Extract narration-ready plain text for ElevenLabs AI voice-over. Edits persist while
            navigating tabs in this document window.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button buttonStyle="secondary" onClick={handleGenerate} type="button">
            {hasGenerated ? "Regenerate Text" : "Generate Narration Text"}
          </Button>
          {hasGenerated && (
            <Button buttonStyle="primary" onClick={handleCopy} type="button">
              Copy to Clipboard
            </Button>
          )}
        </div>
      </div>

      {hasGenerated && (
        <textarea
          aria-label="Editable narration plain text"
          value={editableText}
          onChange={handleTextChange}
          rows={20}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            padding: "1rem",
            borderRadius: "6px",
            border: "1px solid var(--theme-elevation-200, #333333)",
            backgroundColor: "var(--theme-elevation-50, #121212)",
            color: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      )}
    </div>
  )
}
