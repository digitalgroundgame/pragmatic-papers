"use client"

import { Button, toast, useDocumentInfo, useFormFields } from "@payloadcms/ui"
import React, { useState, useSyncExternalStore } from "react"
import { extractNarrationText } from "@/collections/Articles/narration/extractNarrationText"
import {
  collectAuthorIds,
  collectMediaIdsFromContent,
  fetchAuthorsMap,
  fetchMediaMap,
} from "@/collections/Articles/narration/fetchNarrationDocs"

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

function renderFormattedNarration(text: string): React.ReactNode {
  const paragraphs = text.split("\n\n")

  return (
    <div
      aria-label="Formatted narration preview"
      style={{
        padding: "1rem",
        borderRadius: "6px",
        border: "1px solid var(--theme-elevation-200, #333333)",
        backgroundColor: "var(--theme-elevation-50, #121212)",
        lineHeight: "1.6",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        fontSize: "0.95rem",
      }}
    >
      {paragraphs.map((p, idx) => {
        const lines = p.split("\n")
        return (
          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim()
              if (!trimmed) return null

              if (trimmed.startsWith("<break time=")) {
                return (
                  <div key={lineIdx} style={{ margin: "0.25rem 0" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(236, 201, 75, 0.15)",
                        border: "1px solid rgba(236, 201, 75, 0.4)",
                        color: "#ecc94b",
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        fontWeight: 600,
                      }}
                    >
                      {trimmed}
                    </span>
                  </div>
                )
              }

              return (
                <p key={lineIdx} style={{ margin: 0 }}>
                  {line}
                </p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function ExtractNarrationButton(): React.ReactNode {
  const isMounted = useIsMounted()
  const docInfo = useDocumentInfo()
  const docId = docInfo?.id
  const cacheKey = getNarrationCacheKey(docId)

  const [viewMode, setViewMode] = useState<"formatted" | "edit">("formatted")
  const [isGenerating, setIsGenerating] = useState(false)
  const [editableText, setEditableText] = useState(() => {
    return inMemoryNarrationCache.get(cacheKey)?.text ?? ""
  })
  const [hasGenerated, setHasGenerated] = useState(() => {
    return inMemoryNarrationCache.get(cacheKey)?.hasGenerated ?? false
  })

  const { title, authors, publishedAt, content } = useFormFields(([fields]) => {
    const f = fields || {}
    return {
      title: f.title?.value as string | undefined,
      authors: f.authors?.value,
      publishedAt: f.publishedAt?.value as string | Date | undefined,
      content: f.content?.value as Record<string, unknown> | undefined,
    }
  })

  const handleGenerate = async (): Promise<void> => {
    setIsGenerating(true)
    try {
      // Either fetch failing throws, so the catch below reports it rather than a
      // script without its byline or alt text.
      const authorIds = collectAuthorIds(authors)
      const [authorsMap, mediaMap] = await Promise.all([
        fetchAuthorsMap(authorIds),
        fetchMediaMap(collectMediaIdsFromContent(content)),
      ])
      // An author the API didn't return (a deleted user) is left out. Never fall
      // back to the raw id: it would be read aloud as the byline.
      const resolvedAuthors = authorIds.flatMap((id) => authorsMap[id] ?? [])

      const text = extractNarrationText({
        title,
        authors: resolvedAuthors,
        publishedAt,
        content,
        mediaMap,
      })
      const isRegenerating = hasGenerated
      setEditableText(text)
      setHasGenerated(true)
      inMemoryNarrationCache.set(cacheKey, { text, hasGenerated: true })
      toast.success(isRegenerating ? "Narration text regenerated!" : "Narration text generated!")
    } catch (err) {
      toast.error(
        `Failed to generate narration text: ${err instanceof Error ? err.message : "Unknown error"}`,
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const text = e.target.value
    setEditableText(text)
    inMemoryNarrationCache.set(cacheKey, { text, hasGenerated: true })
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
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>Narration Script</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8 }}>
            Extract narration-ready script for ElevenLabs AI voice-over. Edits persist while
            navigating tabs, but will be reset if the page is reloaded.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {hasGenerated && (
            <Button
              buttonStyle="subtle"
              onClick={() => setViewMode(viewMode === "formatted" ? "edit" : "formatted")}
              type="button"
            >
              {viewMode === "formatted" ? "Edit Text" : "Formatted View"}
            </Button>
          )}
          <Button
            buttonStyle="secondary"
            disabled={isGenerating}
            onClick={handleGenerate}
            type="button"
          >
            {isGenerating
              ? "Generating..."
              : hasGenerated
                ? "Regenerate Text"
                : "Generate Narration Text"}
          </Button>
          {hasGenerated && (
            <Button buttonStyle="primary" onClick={handleCopy} type="button">
              Copy to Clipboard
            </Button>
          )}
        </div>
      </div>

      {hasGenerated &&
        (viewMode === "formatted" ? (
          renderFormattedNarration(editableText)
        ) : (
          <textarea
            aria-label="Editable narration script"
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
        ))}
    </div>
  )
}
