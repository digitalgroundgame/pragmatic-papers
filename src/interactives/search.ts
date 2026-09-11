import {
  DRILLDOWN_SEARCH_SCHEMA,
  type SearchEntry,
  type SearchIndex,
} from "@/interactives/engine/search"

import type { DrilldownData, DrilldownPresentation } from "./types"

/**
 * The search index for an interactive: every record's name, the region it belongs to and its
 * picture, and nothing else. It is composed the same way as every other view — the fields come
 * from the code-owned `display`, the values come from the feed — so a feed cannot decide what
 * a result says any more than it can decide a colour.
 *
 * The picture roughly doubles the file. It earns that: a list of names alone makes a reader
 * read every one, and a face is recognised before it is read.
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
  const imageField = presentation.display.image?.url
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
    const image = imageField ? record[imageField] : undefined
    entries.push({
      id,
      name,
      region: record._region,
      ...(typeof image === "string" && image !== "" ? { image } : {}),
    })
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))
  return { schema: DRILLDOWN_SEARCH_SCHEMA, entries }
}
