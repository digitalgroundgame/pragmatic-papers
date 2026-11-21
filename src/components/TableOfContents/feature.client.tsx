"use client"

import "./feature.scss"

import type { PluginComponentWithAnchor } from "@payloadcms/richtext-lexical"
import { createClientFeature } from "@payloadcms/richtext-lexical/client"
import { $getNodeByKey } from "@payloadcms/richtext-lexical/lexical"
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext"
import { useFormFields } from "@payloadcms/ui"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ListTreeIcon } from "lucide-react"

import { $selectedHeading, type SelectedHeading, setHeadingTocLabel } from "./headingLabels"

const baseClass = "toc-label"
const SHOW_FIELD = "showTableOfContents"

/**
 * While the cursor is in a heading, a small button at the heading's end shows
 * its table of contents label (or just an icon). Clicking it opens a box under
 * the heading for the label, with the heading's own text as its placeholder.
 * Both show only while the document's "Show table of contents" is ticked.
 */
export const TocLabelPlugin: PluginComponentWithAnchor = ({ anchorElem }) => {
  const [editor] = useLexicalComposerContext()
  const show = useFormFields(([fields]) => fields[SHOW_FIELD]?.value === true)
  const [heading, setHeading] = useState<SelectedHeading | null>(null)
  const [draft, setDraft] = useState("")
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, bottom: 0, left: 0, right: 0 })
  const input = useRef<HTMLInputElement>(null)
  const current = useRef<SelectedHeading | null>(null)

  const place = useCallback(() => {
    const key = current.current?.key
    const element = key ? editor.getElementByKey(key) : null
    if (element) {
      const rect = element.getBoundingClientRect()
      const anchor = anchorElem.getBoundingClientRect()
      setPosition({
        top: rect.top - anchor.top,
        bottom: rect.bottom - anchor.top,
        left: rect.left - anchor.left,
        right: anchor.right - rect.right,
      })
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
        if (!typing) {
          setDraft(next?.label ?? "")
          if (next?.key !== current.current?.key) setOpen(false)
        }
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

  const close = () => {
    setOpen(false)
    editor.focus()
  }
  const label = draft.trim()

  return createPortal(
    open ? (
      <div className={baseClass} style={{ top: position.bottom, left: position.left }}>
        <label className={`${baseClass}__label`} htmlFor={`${baseClass}-${heading.key}`}>
          In the table of contents
        </label>
        <input
          ref={input}
          id={`${baseClass}-${heading.key}`}
          className={`${baseClass}__input`}
          type="text"
          autoFocus
          value={draft}
          placeholder={heading.text}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setDraft(event.target.value)
            setHeadingTocLabel(editor, heading.key, event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault()
              close()
            }
          }}
        />
      </div>
    ) : (
      <button
        type="button"
        className={`${baseClass}__toggle`}
        style={{ top: position.top, right: position.right }}
        title={
          label ? `In the table of contents as “${label}”` : "Shorten in the table of contents"
        }
        aria-label={
          label
            ? `Table of contents label: ${label}. Change it`
            : "Give this heading a shorter table of contents label"
        }
        // Keep the editor's selection, so the heading stays the one being labelled.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen(true)}
      >
        <ListTreeIcon aria-hidden="true" />
        {label && <span className={`${baseClass}__current`}>{label}</span>}
      </button>
    ),
    anchorElem,
  )
}

export const TableOfContentsLabelsFeatureClient = createClientFeature(() => ({
  plugins: [{ Component: TocLabelPlugin, position: "floatingAnchorElem" }],
}))
