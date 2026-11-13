import { INSERT_INLINE_BLOCK_COMMAND } from "@payloadcms/richtext-lexical/client"
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from "@payloadcms/richtext-lexical/lexical"

/**
 * A footnote sits against the word it follows (`word[1]`), but writers type a
 * space before inserting one, since the `/` menu only opens after a space. So
 * inserting a footnote removes the one plain space right before it. Only an
 * insert does this: loading, pasting and undo leave stored text alone, and a
 * non-breaking space or a second space is kept.
 */

/** Deletes `text`'s character at `offset` when it's a plain space. */
const $deleteSpaceAt = (text: TextNode, offset: number): void => {
  if (offset < 0 || text.getTextContent()[offset] !== " ") return
  if (text.getTextContentSize() === 1) {
    text.remove()
    return
  }
  const selection = $getSelection()
  text.spliceText(offset, 1, "")
  // spliceText leaves a caret in this node where it was, which may now be past its end.
  if ($isRangeSelection(selection)) {
    for (const point of [selection.anchor, selection.focus]) {
      if (point.key === text.getKey() && point.offset > offset) {
        point.set(point.key, point.offset - 1, "text")
      }
    }
  }
}

/** The text a reader sees last in `node`: itself, or the end of a link or other inline element. */
const $lastText = (node: LexicalNode | null): TextNode | null => {
  let current = node
  while ($isElementNode(current) && current.isInline()) current = current.getLastChild()
  return $isTextNode(current) && current.isSimpleText() ? current : null
}

/** Removes one plain space from the end of the text right before `node`. */
export const $trimSpaceBefore = (node: LexicalNode): void => {
  const text = $lastText(node.getPreviousSibling())
  if (text) $deleteSpaceAt(text, text.getTextContentSize() - 1)
}

/** Removes one plain space right before a collapsed caret. */
export const $trimSpaceBeforeSelection = (): void => {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return
  const { offset } = selection.anchor
  const node = selection.anchor.getNode()
  if ($isTextNode(node)) {
    if (offset > 0) {
      if (node.isSimpleText()) $deleteSpaceAt(node, offset - 1)
    } else {
      $trimSpaceBefore(node)
    }
    return
  }
  if ($isElementNode(node) && offset > 0) {
    const text = $lastText(node.getChildAtIndex(offset - 1))
    if (text) $deleteSpaceAt(text, text.getTextContentSize() - 1)
  }
}

/**
 * Trims the space before a footnote inserted from the `/` menu or the toolbar.
 * Both dispatch Payload's insert command, whose own handler runs after this one
 * in the same update, so one undo restores the space with the insert.
 */
export const registerFootnoteSpaceTrim = (editor: LexicalEditor): (() => void) =>
  editor.registerCommand(
    INSERT_INLINE_BLOCK_COMMAND,
    (fields) => {
      if ((fields as { blockType?: string } | undefined)?.blockType === "footnote") {
        $trimSpaceBeforeSelection()
      }
      return false
    },
    COMMAND_PRIORITY_LOW,
  )
