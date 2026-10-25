import {
  $getRoot,
  $isElementNode,
  $setState,
  createState,
  type LexicalEditor,
  type LexicalNode,
} from "@payloadcms/richtext-lexical/lexical"
import { $isHeadingNode, type HeadingNode } from "@payloadcms/richtext-lexical/lexical/rich-text"

import { TOC_LABEL_KEY } from "./label"

/** Empty is the default, which Lexical leaves out of the saved JSON. */
export const tocLabelState = createState(TOC_LABEL_KEY, {
  parse: (value) => (typeof value === "string" ? value : ""),
})

function $headings(): HeadingNode[] {
  const out: HeadingNode[] = []
  const walk = (node: LexicalNode): void => {
    if ($isHeadingNode(node)) out.push(node)
    if ($isElementNode(node)) for (const child of node.getChildren()) walk(child)
  }
  walk($getRoot())
  return out
}

/**
 * Sets the table of contents label of the `index`th heading in the document
 * (the order the saved JSON lists them in); an empty label goes back to the
 * heading's own text.
 */
export function setHeadingTocLabel(editor: LexicalEditor, index: number, label: string): void {
  editor.update(() => {
    const heading = $headings()[index]
    if (heading) $setState(heading, tocLabelState, label)
  })
}
