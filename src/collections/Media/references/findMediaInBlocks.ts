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
export function mediaIdOf(value: unknown): string | undefined {
  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id
    return id == null ? undefined : String(id)
  }
  return value == null ? undefined : String(value)
}

export function isMediaId(value: unknown, mediaId: number | string): boolean {
  return mediaIdOf(value) === String(mediaId)
}

/** Maps each media id under `value` to the block types (once each) that hold it. */
export function mediaInBlocks(value: unknown): Map<string, string[]> {
  const found = new Map<string, Set<string>>()

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== "object") return

    const record = node as Record<string, unknown>
    const blockType = typeof record.blockType === "string" ? record.blockType : undefined
    const mediaOf = blockType ? MEDIA_IN_BLOCK[blockType] : undefined
    if (blockType && mediaOf) {
      for (const media of mediaOf(record)) {
        const id = mediaIdOf(media)
        if (id === undefined) continue
        const blockTypes = found.get(id) ?? new Set<string>()
        blockTypes.add(blockType)
        found.set(id, blockTypes)
      }
    }

    Object.values(record).forEach(walk)
  }

  walk(value)
  return new Map([...found].map(([id, blockTypes]) => [id, [...blockTypes]]))
}

/** Returns the block types (once each) under `value` that hold `mediaId`. */
export function findMediaInBlocks(value: unknown, mediaId: number | string): string[] {
  return mediaInBlocks(value).get(String(mediaId)) ?? []
}
