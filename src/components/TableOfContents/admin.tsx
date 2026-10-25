"use client"

import "./admin.scss"

import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import type { LexicalEditor, SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import { CheckboxField, useField, useFormFields } from "@payloadcms/ui"
import type { CheckboxFieldClientComponent } from "payload"
import React, { useEffect, useMemo, useRef, useState } from "react"

import { stampTableOfContentsAnchors, tableOfContentsEntries } from "."
import { useRegisteredEditor } from "./editorRegistry"
import { setHeadingTocLabel } from "./headingLabels"
import { TOC_LABEL_KEY } from "./label"
import { extractText } from "./traverse"
import type { AnchoredNode, TableOfContentsEntry } from "./types"

const baseClass = "toc-preview"
const CONTENT_PATH = "content"

interface HeadingInfo {
  /** Its place among the document's headings, which is how the editor finds it. */
  index: number
  text: string
  label: string
}

type HeadingNode = AnchoredNode & {
  children?: SerializedLexicalNode[]
  $?: Record<string, unknown>
}

/** Every heading by its stamped anchor, in the order the editor holds them. */
function headingsByAnchor(content: DefaultTypedEditorState): Map<string, HeadingInfo> {
  const out = new Map<string, HeadingInfo>()
  let index = 0
  const walk = (nodes: SerializedLexicalNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      if (node.type === "heading") {
        const heading = node as HeadingNode
        const label = heading.$?.[TOC_LABEL_KEY]
        if (heading.anchor) {
          out.set(heading.anchor, {
            index,
            text: extractText(heading.children).trim(),
            label: typeof label === "string" ? label : "",
          })
        }
        index++
      }
      walk((node as HeadingNode).children)
    }
  }
  walk(content.root.children as SerializedLexicalNode[])
  return out
}

/**
 * Keeps what the writer types while they're in the box: the form's copy of the
 * editor catches up half a second later, and mustn't undo their keystrokes.
 */
function HeadingLabelInput({
  editor,
  heading,
}: {
  editor: LexicalEditor
  heading: HeadingInfo
}): React.ReactNode {
  const [draft, setDraft] = useState(heading.label)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(heading.label)
  }, [heading.label])

  return (
    <input
      className={`${baseClass}__input`}
      type="text"
      value={draft}
      placeholder={heading.text}
      aria-label={`Table of contents label for “${heading.text}”`}
      onFocus={() => (focused.current = true)}
      onBlur={() => (focused.current = false)}
      onChange={(event) => {
        setDraft(event.target.value)
        setHeadingTocLabel(editor, heading.index, event.target.value)
      }}
    />
  )
}

interface PreviewListProps {
  entries: TableOfContentsEntry[]
  headings: Map<string, HeadingInfo>
  editor: LexicalEditor | undefined
}

function PreviewList({ entries, headings, editor }: PreviewListProps): React.ReactNode {
  return (
    <ul className={`${baseClass}__list`}>
      {entries.map((entry, index) => {
        const heading = headings.get(entry.anchor)
        // A heading's anchor follows its label, so it's keyed by its place instead,
        // or its input would remount (and lose focus) on every keystroke.
        const key = heading ? `heading-${heading.index}` : `${entry.anchor}-${index}`
        return (
          <li key={key}>
            <span className={`${baseClass}__label`} title={`#${entry.anchor}`}>
              {entry.icon && <span className={`${baseClass}__icon`}>{entry.icon}</span>}
              {heading && editor ? (
                <HeadingLabelInput editor={editor} heading={heading} />
              ) : (
                entry.label
              )}
            </span>
            {entry.children?.length ? (
              <PreviewList entries={entry.children} headings={headings} editor={editor} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Stamps the live editor state here because the saved anchors only exist
 * after a save, and the preview should follow keystrokes. Where the editor
 * has `TableOfContentsLabelsFeature`, each heading's entry is a box for a
 * shorter label, with the heading's own text as its placeholder.
 */
function TableOfContentsPreview(): React.ReactNode {
  const content = useFormFields(([fields]) => fields[CONTENT_PATH]?.value) as
    DefaultTypedEditorState | undefined
  const editor = useRegisteredEditor(CONTENT_PATH)
  const { entries, headings } = useMemo(() => {
    if (!content?.root) return { entries: [], headings: new Map<string, HeadingInfo>() }
    const stamped = stampTableOfContentsAnchors(content)
    return { entries: tableOfContentsEntries(stamped), headings: headingsByAnchor(stamped) }
  }, [content])

  return (
    <section className={baseClass} aria-label="Table of contents preview">
      {entries.length > 0 ? (
        <>
          {editor && (
            <p className={`${baseClass}__note`}>
              Type a shorter label for any heading. Leave it empty to use the heading.
            </p>
          )}
          <PreviewList entries={entries} headings={headings} editor={editor} />
        </>
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
