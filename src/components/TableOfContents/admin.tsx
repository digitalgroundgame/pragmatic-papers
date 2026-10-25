"use client"

import "./admin.scss"

import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { CheckboxField, useField, useFormFields } from "@payloadcms/ui"
import type { CheckboxFieldClientComponent } from "payload"
import React, { useMemo } from "react"

import { stampTableOfContentsAnchors, tableOfContentsEntries } from "."
import type { TableOfContentsEntry } from "./types"

const baseClass = "toc-preview"

function PreviewList({ entries }: { entries: TableOfContentsEntry[] }): React.ReactNode {
  return (
    <ul className={`${baseClass}__list`}>
      {entries.map((entry, index) => (
        <li key={`${entry.anchor}-${index}`}>
          <span className={`${baseClass}__label`} title={`#${entry.anchor}`}>
            {entry.icon && <span className={`${baseClass}__icon`}>{entry.icon}</span>}
            {entry.label}
          </span>
          {entry.children?.length ? <PreviewList entries={entry.children} /> : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * Stamps the live editor state here because the saved anchors only exist
 * after a save, and the preview should follow keystrokes.
 */
function TableOfContentsPreview(): React.ReactNode {
  const content = useFormFields(([fields]) => fields.content?.value) as
    DefaultTypedEditorState | undefined
  const entries = useMemo(
    () => (content?.root ? tableOfContentsEntries(stampTableOfContentsAnchors(content)) : []),
    [content],
  )

  return (
    <section className={baseClass} aria-label="Table of contents preview">
      {entries.length > 0 ? (
        <PreviewList entries={entries} />
      ) : (
        <p className={`${baseClass}__note`}>Add a heading to build the table of contents.</p>
      )}
    </section>
  )
}

export const TableOfContentsCheckbox: CheckboxFieldClientComponent = ({ path, ...props }) => {
  const { value } = useField<boolean>({ path })

  return (
    <>
      <CheckboxField path={path} {...props} />
      {value && <TableOfContentsPreview />}
    </>
  )
}
