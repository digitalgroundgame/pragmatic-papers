import {
  $getNodeByKey,
  $getSelection,
  $getState,
  $isRangeSelection,
  $setState,
  createState,
  type LexicalEditor,
  SKIP_DOM_SELECTION_TAG,
} from "@payloadcms/richtext-lexical/lexical"
import { $isHeadingNode, type HeadingNode } from "@payloadcms/richtext-lexical/lexical/rich-text"
import { $findMatchingParent } from "@payloadcms/richtext-lexical/lexical/utils"

import { TOC_LABEL_KEY } from "./label"

/** Empty is the default, which Lexical leaves out of the saved JSON. */
export const tocLabelState = createState(TOC_LABEL_KEY, {
  parse: (value) => (typeof value === "string" ? value : ""),
})

export interface SelectedHeading {
  key: string
  text: string
  label: string
}

/** The heading the selection is in, if it's in one. Call inside a read or update. */
export function $selectedHeading(): SelectedHeading | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null
  const heading = $findMatchingParent(
    selection.anchor.getNode(),
    $isHeadingNode,
  ) as HeadingNode | null
  if (!heading) return null
  return {
    key: heading.getKey(),
    text: heading.getTextContent().trim(),
    label: $getState(heading, tocLabelState),
  }
}

/**
 * Sets a heading's table of contents label; empty goes back to its own text.
 * It leaves the page's selection alone, or the editor would take the focus
 * back from the label box after the first keystroke.
 */
export function setHeadingTocLabel(editor: LexicalEditor, key: string, label: string): void {
  editor.update(
    () => {
      const heading = $getNodeByKey(key)
      if ($isHeadingNode(heading)) $setState(heading, tocLabelState, label)
    },
    { tag: SKIP_DOM_SELECTION_TAG },
  )
}
