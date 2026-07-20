"use client"

import { Button, toast, useFormFields } from "@payloadcms/ui"
import React, { useSyncExternalStore, useState } from "react"
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

export function ExtractNarrationButton(): React.ReactNode {
  const isMounted = useIsMounted()
  const [editableText, setEditableText] = useState("")
  const [hasGenerated, setHasGenerated] = useState(false)

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
    setEditableText(text)
    setHasGenerated(true)
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
            Extract narration-ready plain text for ElevenLabs AI voice-over. Edits here are
            ephemeral.
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
          onChange={(e) => setEditableText(e.target.value)}
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
