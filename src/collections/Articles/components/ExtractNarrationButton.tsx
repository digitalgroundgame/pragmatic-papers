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

function collectMediaIdsFromContent(content: unknown): Array<string | number> {
  const ids = new Set<string | number>()

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return
    const obj = node as Record<string, unknown>

    if (obj.type === "block" && obj.fields && typeof obj.fields === "object") {
      const fields = obj.fields as Record<string, unknown>
      const blockType = fields.blockType as string | undefined

      if (blockType === "mediaBlock" && fields.media) {
        const m = fields.media
        if (typeof m === "number" || typeof m === "string") {
          ids.add(m)
        } else if (typeof m === "object" && m !== null) {
          const mediaObj = m as Record<string, unknown>
          if (typeof mediaObj.id === "number" || typeof mediaObj.id === "string") {
            if (!mediaObj.alt && !mediaObj.caption) {
              ids.add(mediaObj.id as string | number)
            }
          } else if (
            "value" in mediaObj &&
            (typeof mediaObj.value === "number" || typeof mediaObj.value === "string")
          ) {
            ids.add(mediaObj.value as string | number)
          }
        }
      } else if (blockType === "mediaCollage" && Array.isArray(fields.images)) {
        for (const img of fields.images as Record<string, unknown>[]) {
          if (img && typeof img === "object" && img.media) {
            const m = img.media
            if (typeof m === "number" || typeof m === "string") {
              ids.add(m)
            } else if (typeof m === "object" && m !== null) {
              const mediaObj = m as Record<string, unknown>
              if (typeof mediaObj.id === "number" || typeof mediaObj.id === "string") {
                if (!mediaObj.alt && !mediaObj.caption) {
                  ids.add(mediaObj.id as string | number)
                }
              } else if (
                "value" in mediaObj &&
                (typeof mediaObj.value === "number" || typeof mediaObj.value === "string")
              ) {
                ids.add(mediaObj.value as string | number)
              }
            }
          }
        }
      }
    }

    if (Array.isArray(obj.children)) {
      for (const child of obj.children) {
        traverse(child)
      }
    }
    if (obj.root && typeof obj.root === "object") {
      traverse(obj.root)
    }
  }

  traverse(content)
  return Array.from(ids)
}

async function fetchMediaMap(
  mediaIds: Array<string | number>,
): Promise<
  Record<string | number, { alt?: string | null; caption?: unknown; filename?: string | null }>
> {
  if (mediaIds.length === 0) return {}

  const map: Record<
    string | number,
    { alt?: string | null; caption?: unknown; filename?: string | null }
  > = {}
  const CHUNK_SIZE = 25
  const chunks: Array<Array<string | number>> = []

  for (let i = 0; i < mediaIds.length; i += CHUNK_SIZE) {
    chunks.push(mediaIds.slice(i, i + CHUNK_SIZE))
  }

  try {
    await Promise.all(
      chunks.map(async (chunk) => {
        const params = chunk
          .map((id, idx) => `where[id][in][${idx}]=${encodeURIComponent(String(id))}`)
          .join("&")
        const res = await fetch(`/api/media?${params}&depth=1&limit=${chunk.length}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data?.docs)) {
            for (const doc of data.docs) {
              if (doc && (typeof doc.id === "number" || typeof doc.id === "string")) {
                map[doc.id] = {
                  alt: typeof doc.alt === "string" ? doc.alt : null,
                  caption: doc.caption,
                  filename: typeof doc.filename === "string" ? doc.filename : null,
                }
              }
            }
          }
        }
      }),
    )
  } catch (err) {
    console.error("Failed to fetch media documents for narration extraction:", err)
  }
  return map
}

export function ExtractNarrationButton(): React.ReactNode {
  const isMounted = useIsMounted()
  const docInfo = useDocumentInfo()
  const docId = docInfo?.id
  const cacheKey = getNarrationCacheKey(docId)

  const [viewMode, setViewMode] = useState<"formatted" | "edit">("formatted")
  const [isGenerating, setIsGenerating] = useState(false)
  const [editableText, setEditableText] = useState(() => {
    const cached = getStoredNarration(cacheKey)
    return cached ? cached.text : ""
  })
  const [hasGenerated, setHasGenerated] = useState(() => {
    const cached = getStoredNarration(cacheKey)
    return cached ? cached.hasGenerated : false
  })

  const { title, authors, populatedAuthors, publishedAt, content } = useFormFields(([fields]) => {
    const f = fields || {}
    return {
      title: f.title?.value as string | undefined,
      authors: f.authors?.value as Array<Record<string, unknown> | string | number> | undefined,
      populatedAuthors: f.populatedAuthors?.value as Array<{ name?: string }> | undefined,
      publishedAt: f.publishedAt?.value as string | Date | undefined,
      content: f.content?.value as Record<string, unknown> | undefined,
    }
  })

  const handleGenerate = async (): Promise<void> => {
    setIsGenerating(true)
    try {
      const mediaIds = collectMediaIdsFromContent(content)
      const mediaMap = await fetchMediaMap(mediaIds)
      const text = extractNarrationText({
        title,
        authors,
        populatedAuthors,
        publishedAt,
        content,
        mediaMap,
      })
      const isRegenerating = hasGenerated
      setEditableText(text)
      setHasGenerated(true)
      setStoredNarration(cacheKey, { text, hasGenerated: true })
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
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>Narration Script</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8 }}>
            Extract narration-ready script for ElevenLabs AI voice-over. Edits persist while
            navigating tabs in this document window.
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
