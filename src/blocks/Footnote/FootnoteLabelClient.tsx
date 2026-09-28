"use client"

import type { FootnoteBlock, FootnotesField } from "@/payload-types"
import { useDocumentInfo } from "@payloadcms/ui"
import React from "react"

import { getFootnotes, truncate } from "./utils"

const PREVIEW_LIMIT = 20

interface FootnoteLabelClientProps {
  siblingData?: Partial<FootnoteBlock> | null
}

// A sourceId always points at an already-persisted footnote, so it's the most direct match.
export const resolveIndexBySourceId = (
  footnotes: NonNullable<FootnotesField>,
  sourceId: string | null | undefined,
): number | null => {
  if (!sourceId) return null
  const i = footnotes.findIndex((f) => f.id === sourceId)
  return i > -1 ? (footnotes[i]?.index ?? null) : null
}

// The only option for an original footnote still being typed; also covers a sourceId
// gone stale (e.g. its target was removed).
export const resolveIndexByNote = (
  footnotes: NonNullable<FootnotesField>,
  note: string | null | undefined,
): number | null => {
  if (!note) return null
  const i = footnotes.findIndex((f) => f.note === note)
  return i > -1 ? (footnotes[i]?.index ?? null) : null
}

const resolveIndex = (
  footnotes: NonNullable<FootnotesField>,
  { sourceId, note, index }: Pick<Partial<FootnoteBlock>, "sourceId" | "note" | "index">,
): number | null =>
  resolveIndexBySourceId(footnotes, sourceId) ??
  resolveIndexByNote(footnotes, note) ??
  (typeof index === "number" ? index : null)

export const FootnoteLabelClient: React.FC<FootnoteLabelClientProps> = ({ siblingData }) => {
  const { note, sourceId, index } = siblingData ?? {}
  const { data } = useDocumentInfo()
  const footnotes = getFootnotes(data)
  const currentIndex = resolveIndex(footnotes, { sourceId, note, index })

  if (!note) return <span>Footnote</span>
  if (typeof currentIndex !== "number") return <span>{truncate(note, PREVIEW_LIMIT)}</span>
  if (sourceId) return <span>{`↗ [${currentIndex}]`}</span>
  return <span>{`[${currentIndex}]`}</span>
}
