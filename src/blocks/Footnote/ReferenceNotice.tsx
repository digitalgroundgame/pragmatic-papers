"use client"

import type { FootnotesField } from "@/payload-types"
import { useDocumentInfo, useField } from "@payloadcms/ui"
import React from "react"

export const ReferenceNotice: React.FC = () => {
  const { value: sourceId } = useField<string>({ path: "sourceId" })
  const { value: formNote } = useField<string>({ path: "note" })
  const { value: index } = useField<number>({ path: "index" })
  const { data } = useDocumentInfo()

  const footnotes = (data?.footnotes as NonNullable<FootnotesField>) ?? []
  const footnote = footnotes.find((f) => f.id === sourceId)

  const note = footnote?.note ?? formNote
  const attributionUrl =
    footnote?.attributionEnabled && footnote.link?.type === "custom" ? footnote.link.url : null

  return (
    <div className="field-type">
      <div className="label-wrapper">
        <p className="field-label">Linked Footnote:</p>
      </div>
      <p
        style={{
          margin: 0,
          padding: "2rem",
          border: "1px solid #e0e0e0",
          borderRadius: "0.5rem",
        }}
      >
        {index && <span>{`${index}. `}</span>}
        {note}
        {attributionUrl && <span>{` | ${attributionUrl}`}</span>}
      </p>
      <p style={{ marginTop: "0.5rem", opacity: 0.5 }}>
        To make changes, delete this footnote block and re-add it.
      </p>
    </div>
  )
}
