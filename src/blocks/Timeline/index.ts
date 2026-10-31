import { ChartGanttIcon } from "lucide-react"

import type { LexicalNode } from "@/blocks/feed/types"
import { defineBlock } from "@/blocks/types"
import type { TimelineBlock } from "@/payload-types"

import { timelineToHTML } from "./converters"
import { describeTimeline } from "./narration"

const EVENTS_PER_PAGE = 3

const eventsOf = (value: unknown): Array<Record<string, unknown> | null | undefined> =>
  Array.isArray(value) ? value : []

export const timelineBlock = defineBlock<TimelineBlock>({
  slug: "timeline",
  html: timelineToHTML,
  narrate: describeTimeline,
  // A page per three events.
  readingFeed: {
    placement: "split",
    durationMs: 8000,
    split: (node) => {
      const fields = (node.fields ?? {}) as Record<string, unknown>
      const events = eventsOf(fields.events)
      // An empty timeline: no pages, so the chunker's fallback renders the original node.
      const pages: LexicalNode[] = []
      for (let i = 0; i < events.length; i += EVENTS_PER_PAGE) {
        pages.push({
          type: "block",
          version: 1,
          fields: { ...fields, events: events.slice(i, i + EVENTS_PER_PAGE) },
        })
      }
      return pages
    },
  },
  tableOfContents: ({ title }) => ({ label: title || "Timeline", icon: ChartGanttIcon }),
  media: {
    find: (block) => eventsOf(block.events).map((event) => event?.avatar),
    // An event loses its avatar.
    detach: (block, uses) => {
      const events = eventsOf(block.events)
      if (!events.some((event) => event && uses(event.avatar))) return block
      return {
        ...block,
        events: events.map((event) =>
          event && uses(event.avatar) ? { ...event, avatar: null } : event,
        ),
      }
    },
  },
})
