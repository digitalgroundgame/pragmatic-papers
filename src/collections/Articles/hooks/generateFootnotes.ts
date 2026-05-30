import type { Article, FootnoteBlock, FootnotesField } from "@/payload-types"
import type { SerializedInlineBlockNode } from "@payloadcms/richtext-lexical"
import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"
import type { CollectionBeforeChangeHook } from "payload"

type FootnoteFields = FootnoteBlock & { sourceId?: string | null }

const getDedupeKey = (fields: FootnoteBlock): string => {
  if (!fields.attributionEnabled || !fields.link) {
    return fields.note
  }
  if (fields.link.type === "custom") {
    return `${fields.note}|${fields.link.url ?? ""}`
  }
  const ref = fields.link.reference
  const refId =
    typeof ref?.value === "string" ? ref.value : ((ref?.value as { id?: string } | null)?.id ?? "")
  return `${fields.note}|${refId}`
}

export const collectFootnotes = (editorState?: SerializedEditorState): FootnotesField => {
  if (!editorState || typeof editorState !== "object") return []

  const rootChildren = editorState.root?.children
  if (!Array.isArray(rootChildren)) return []

  // Phase 1: single traversal — collect all footnotes in document order, index originals by id
  const collected: FootnoteFields[] = []
  const blockById = new Map<string, FootnoteFields>()

  const visit = (node: SerializedLexicalNode): void => {
    if (!node || typeof node !== "object") return
    if (node.type === "inlineBlock") {
      const fields = (node as SerializedInlineBlockNode<FootnoteBlock>).fields as FootnoteFields
      if (fields.blockType === "footnote") {
        if (!fields.id) fields.id = crypto.randomUUID()
        collected.push(fields)
        if (!fields.sourceId) blockById.set(fields.id, fields)
      }
    }
    if ("children" in node && Array.isArray(node.children)) node.children.forEach(visit)
  }
  rootChildren.forEach(visit)

  // Phase 2: linear pass over collected footnotes — resolve refs, dedup, assign indices
  type FootnoteResult = NonNullable<FootnotesField>[number]
  let footnoteIndex = 0
  const result: FootnotesField = []
  const seen = new Map<string, number>()

  for (const fields of collected) {
    if (fields.sourceId) {
      const source = blockById.get(fields.sourceId)
      if (source) {
        fields.note = source.note
        fields.attributionEnabled = source.attributionEnabled
        fields.link = source.link
      } else {
        // Orphaned reference: promote to standalone original
        fields.sourceId = null
      }
    }

    const key = getDedupeKey(fields)

    if (seen.has(key)) {
      fields.index = seen.get(key)!
    } else {
      footnoteIndex += 1
      fields.index = footnoteIndex
      seen.set(key, footnoteIndex)
      result.push(fields as FootnoteResult)
    }
  }

  return result
}

export const generateFootnotes: CollectionBeforeChangeHook<Article> = ({ data }) => {
  if (data?.content) {
    data.footnotes = collectFootnotes(data.content as SerializedEditorState | undefined)
  }
  return data
}
