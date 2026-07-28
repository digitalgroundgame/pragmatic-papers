import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"
import type { LexicalNode } from "@/app/(feed)/feed/types"

const EVENTS_PER_PAGE = 3

export const timelineFeed: FeedBlockBehavior = {
  placement: "split",
  durationMs: 8000,
  split: (node) => {
    const fields = node.fields as { events?: unknown[] } | undefined
    const events = fields?.events ?? []
    if (events.length === 0) {
      // Empty timeline — keep the original node so the chunker's
      // fallback path renders it (won't be pretty, but won't drop content).
      return []
    }
    const originalFields = (node.fields ?? {}) as Record<string, unknown>
    const pages: LexicalNode[] = []
    for (let i = 0; i < events.length; i += EVENTS_PER_PAGE) {
      const slice = events.slice(i, i + EVENTS_PER_PAGE)
      pages.push({
        type: "block",
        version: 1,
        fields: { ...originalFields, events: slice },
      })
    }
    return pages
  },
}
