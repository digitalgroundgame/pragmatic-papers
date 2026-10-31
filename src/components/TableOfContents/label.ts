import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"

/**
 * The key a heading's table of contents label is kept under, in the node's
 * Lexical state (`"$"` in its JSON), which the editor keeps through every load
 * and save without a schema change.
 */
export const TOC_LABEL_KEY = "tocLabel"

type WithState = SerializedLexicalNode & { $?: Record<string, unknown> }

/** The label a writer gave a heading for the table of contents, if any. */
export function headingTocLabel(node: SerializedLexicalNode): string | undefined {
  const label = (node as WithState).$?.[TOC_LABEL_KEY]
  return typeof label === "string" && label.trim() ? label.trim() : undefined
}
