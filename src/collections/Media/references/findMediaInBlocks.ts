function arrayOf(value: unknown): Array<Record<string, unknown> | undefined> {
  return Array.isArray(value) ? value : []
}

/**
 * Where each block that holds media keeps it. Blocks look the same whether they sit
 * in a `blocks` field (a page's layout) or inside Lexical rich text (a block node's
 * `fields`), so one walk over the stored JSON finds both, at any depth.
 */
const MEDIA_IN_BLOCK: Record<string, (block: Record<string, unknown>) => unknown[]> = {
  mediaBlock: (block) => [block.media],
  mediaCollage: (block) => arrayOf(block.images).map((image) => image?.media),
  timeline: (block) => arrayOf(block.events).map((event) => event?.avatar),
}

/** A relationship value is an id at depth 0, or the populated document above it. */
export function isMediaId(value: unknown, mediaId: number | string): boolean {
  if (value && typeof value === "object") {
    return String((value as { id?: unknown }).id) === String(mediaId)
  }
  return value != null && String(value) === String(mediaId)
}

/** Returns the block types (once each) under `value` that hold `mediaId`. */
export function findMediaInBlocks(value: unknown, mediaId: number | string): string[] {
  const found = new Set<string>()

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== "object") return

    const record = node as Record<string, unknown>
    const blockType = typeof record.blockType === "string" ? record.blockType : undefined
    const mediaOf = blockType ? MEDIA_IN_BLOCK[blockType] : undefined
    if (blockType && mediaOf?.(record).some((media) => isMediaId(media, mediaId))) {
      found.add(blockType)
    }

    Object.values(record).forEach(walk)
  }

  walk(value)
  return [...found]
}
