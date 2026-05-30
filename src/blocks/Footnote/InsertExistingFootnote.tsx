"use client"

import type { FootnotesField } from "@/payload-types"
import { type ReactSelectOption, ReactSelect, useDocumentInfo, useField } from "@payloadcms/ui"
import React, { useState } from "react"

export const InsertExistingFootnote: React.FC = () => {
  const { data } = useDocumentInfo()
  const [selected, setSelected] = useState<ReactSelectOption | undefined>(undefined)

  const { setValue: setSourceId } = useField<string>({ path: "sourceId" })
  const { setValue: setNote } = useField<string>({ path: "note" })

  const footnotes = ((data?.footnotes as NonNullable<FootnotesField>) ?? []).filter(
    (footnote) => footnote.note,
  )

  const handleChange = (value: ReactSelectOption | ReactSelectOption[]) => {
    const option = Array.isArray(value) ? value[0] : value
    setSelected(option)
    if (!option) return

    const footnote = footnotes[Number(option.value)]
    if (!footnote) return

    setSourceId(footnote.id ?? "")
    setNote(footnote.note)
  }

  if (!footnotes.length) return null

  const options: ReactSelectOption[] = footnotes.map((footnote, i) => ({
    label: footnote.note.length > 80 ? `${footnote.note.slice(0, 80)}…` : footnote.note,
    value: String(i),
  }))

  return (
    <div className="field-type">
      <div className="label-wrapper">
        <p className="field-label">Link to Existing Footnote</p>
      </div>
      <ReactSelect
        onChange={handleChange}
        options={options}
        placeholder="— Select a footnote to link —"
        value={selected}
      />
    </div>
  )
}
