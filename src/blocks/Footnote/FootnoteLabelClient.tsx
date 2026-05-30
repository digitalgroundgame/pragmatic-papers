"use client"

import type { FootnoteBlock, FootnotesField } from "@/payload-types"
import { useDocumentInfo } from "@payloadcms/ui"
import React from "react"

import { truncate } from "./utils"

const PREVIEW_LIMIT = 20

interface FootnoteLabelClientProps {
  siblingData?: Partial<FootnoteBlock> | null
}

export const FootnoteLabelClient: React.FC<FootnoteLabelClientProps> = ({ siblingData }) => {
  const { note, sourceId, index } = siblingData ?? {}
  const { data } = useDocumentInfo()
  const footnotes = (data?.footnotes as FootnotesField) ?? []
  const currentIndex =
    (note ? (footnotes.find((f) => f.note === note)?.index ?? null) : null) ?? index ?? null

  if (!note) return <span>Footnote</span>
  if (typeof currentIndex !== "number") return <span>{truncate(note, PREVIEW_LIMIT)}</span>
  if (sourceId) return <span>{`↗ [${currentIndex}]`}</span>
  return <span>{`[${currentIndex}]`}</span>
}
