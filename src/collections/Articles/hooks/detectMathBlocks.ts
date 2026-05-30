import type { Article } from "@/payload-types"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import type { CollectionBeforeChangeHook } from "payload"

const hasMathBlock = (node: SerializedLexicalNode): boolean => {
  if (!node || typeof node !== "object") return false

  if (
    (node.type === "inlineBlock" || node.type === "block") &&
    "fields" in node &&
    typeof node.fields === "object" &&
    node.fields !== null &&
    "blockType" in node.fields &&
    (node.fields.blockType === "inlineMathBlock" || node.fields.blockType === "displayMathBlock")
  ) {
    return true
  }

  if ("children" in node && Array.isArray(node.children)) {
    return node.children.some((child: SerializedLexicalNode) => hasMathBlock(child))
  }

  return false
}

export const detectMathBlocks: CollectionBeforeChangeHook<Article> = ({ data }) => {
  if (data.content) {
    data.enableMathRendering = data.content.root.children.some(hasMathBlock)
  }

  return data
}
