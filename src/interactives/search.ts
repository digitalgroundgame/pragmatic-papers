import {
  DRILLDOWN_SEARCH_SCHEMA,
  type SearchEntry,
  type SearchIndex,
} from "@/blocks/InteractiveMap/drilldown/search"

import type { DrilldownData, DrilldownPresentation } from "./types"

/**
 * The search index for an interactive: every record's name and the region it belongs to, and
 * nothing else. It is composed the same way as every other view — the name comes from the
 * code-owned `display.title` field, the values come from the feed — so a feed cannot decide
 * what a result says any more than it can decide a colour.
 *
 * It is served on its own route rather than inlined into the page: the page's initial HTML
 * carries the overview only, and a reader who never uses search never pays for the index.
 */
export function composeSearchIndex({
  presentation,
  data,
}: {
  presentation: DrilldownPresentation
  data: DrilldownData
}): SearchIndex {
  const titleField = presentation.display.title
  const seen = new Set<string>()
  const entries: SearchEntry[] = []

  for (const record of data.records) {
    const id = record._id
    const name = record[titleField]
    // A record with no stable id cannot be pinned once its region loads, so it cannot be a
    // useful result; the same id twice would make two results that do the same thing.
    if (typeof id !== "string" || id === "" || typeof name !== "string" || name.trim() === "")
      continue
    if (seen.has(id)) continue
    seen.add(id)
    entries.push({ id, name, region: record._region })
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))
  return { schema: DRILLDOWN_SEARCH_SCHEMA, entries }
}
