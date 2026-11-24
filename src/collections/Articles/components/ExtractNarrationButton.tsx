"use client"

import { Button, toast, useDocumentInfo, useFormFields } from "@payloadcms/ui"
import React, { useState, useSyncExternalStore } from "react"

import "./ExtractNarrationButton.css"
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
      className="narration-tools__script narration-tools__preview"
    >
      {paragraphs.map((p, idx) => {
        const lines = p.split("\n")
        return (
          <div key={idx} className="narration-tools__paragraph">
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim()
              if (!trimmed) return null

              if (trimmed.startsWith("<break time=")) {
                return (
                  <div key={lineIdx}>
                    <span className="narration-tools__break">{trimmed}</span>
                  </div>
                )
              }

              return (
                <p key={lineIdx} className="narration-tools__line">
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
      <div className="narration-tools">
        <p className="narration-tools__hint">Loading narration tools...</p>
      </div>
    )
  }

  return (
    <div className="narration-tools">
      <div className="narration-tools__header">
        <div>
          <h3 className="narration-tools__title">Narration Script</h3>
          <p className="narration-tools__hint">
            Extract narration-ready script for ElevenLabs AI voice-over. Edits persist while
            navigating tabs, but will be reset if the page is reloaded.
          </p>
        </div>
        <div className="narration-tools__actions">
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
            className="narration-tools__script"
          />
        ))}
    </div>
  )
}
