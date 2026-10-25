"use client"

import "./feature.scss"

import type { PluginComponentWithAnchor } from "@payloadcms/richtext-lexical"
import { createClientFeature } from "@payloadcms/richtext-lexical/client"
import { $getNodeByKey } from "@payloadcms/richtext-lexical/lexical"
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext"
import { useFormFields } from "@payloadcms/ui"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { $selectedHeading, type SelectedHeading, setHeadingTocLabel } from "./headingLabels"

const baseClass = "toc-label"
const SHOW_FIELD = "showTableOfContents"

/**
 * While the cursor is in a heading, a box under it holds the heading's table
 * of contents label, with the heading's own text as its placeholder. It shows
 * only while the document's "Show table of contents" is ticked.
 */
export const TocLabelPlugin: PluginComponentWithAnchor = ({ anchorElem }) => {
  const [editor] = useLexicalComposerContext()
  const show = useFormFields(([fields]) => fields[SHOW_FIELD]?.value === true)
  const [heading, setHeading] = useState<SelectedHeading | null>(null)
  const [draft, setDraft] = useState("")
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const input = useRef<HTMLInputElement>(null)
  const current = useRef<SelectedHeading | null>(null)

  const place = useCallback(() => {
    const key = current.current?.key
    const element = key ? editor.getElementByKey(key) : null
    if (element) {
      const rect = element.getBoundingClientRect()
      const anchor = anchorElem.getBoundingClientRect()
      setPosition({ top: rect.bottom - anchor.top, left: rect.left - anchor.left })
    }
  }, [anchorElem, editor])

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const typing = document.activeElement === input.current
        // While the writer types a label the selection stays put, so keep the
        // heading they're labelling unless it was deleted.
        const next = typing
          ? editorState.read(() =>
              current.current && $getNodeByKey(current.current.key) ? current.current : null,
            )
          : editorState.read($selectedHeading)
        if (!typing) setDraft(next?.label ?? "")
        current.current = next
        setHeading(next)
        place()
      }),
    [editor, place],
  )

  useEffect(() => {
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [place])

  if (!show || !heading || !editor.isEditable()) return null

  return createPortal(
    <div className={baseClass} style={position}>
      <label className={`${baseClass}__label`} htmlFor={`${baseClass}-${heading.key}`}>
        In the table of contents
      </label>
      <input
        ref={input}
        id={`${baseClass}-${heading.key}`}
        className={`${baseClass}__input`}
        type="text"
        value={draft}
        placeholder={heading.text}
        onChange={(event) => {
          setDraft(event.target.value)
          setHeadingTocLabel(editor, heading.key, event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault()
            editor.focus()
          }
        }}
      />
    </div>,
    anchorElem,
  )
}

export const TableOfContentsLabelsFeatureClient = createClientFeature(() => ({
  plugins: [{ Component: TocLabelPlugin, position: "floatingAnchorElem" }],
}))
