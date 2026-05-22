interface LexicalNode {
  type?: string
  children?: LexicalNode[]
  fields?: Record<string, unknown>
  [key: string]: unknown
}

interface MediaReference {
  blockType: string
  field: string
}

export function findMediaReferencesInLexical(
  node: LexicalNode,
  targetMediaId: number | string,
): MediaReference[] {
  const results: MediaReference[] = []

  if (node.type === "block" && node.fields) {
    const blockType = node.fields.blockType as string | undefined

    if (blockType === "mediaBlock" && String(node.fields.media) === String(targetMediaId)) {
      results.push({ blockType: "mediaBlock", field: "media" })
    }

    if (blockType === "mediaCollage") {
      const images = node.fields.images as Array<{ media?: unknown }> | undefined
      if (Array.isArray(images)) {
        for (const image of images) {
          if (image && String(image.media) === String(targetMediaId)) {
            results.push({ blockType: "mediaCollage", field: "images" })
          }
        }
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      results.push(...findMediaReferencesInLexical(child, targetMediaId))
    }
  }

  return results
}

export function findMediaReferencesInLexicalContent(
  content: unknown,
  targetMediaId: number | string,
): MediaReference[] {
  if (!content || typeof content !== "object") return []
  const root = (content as Record<string, unknown>).root as LexicalNode | undefined
  if (!root?.children) return []
  return findMediaReferencesInLexical(root, targetMediaId)
}
