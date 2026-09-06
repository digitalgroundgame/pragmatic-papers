/**
 * Record search for the drilldown engine.
 *
 * A drilldown's records live in per-region assets that only load when a reader drills in, so
 * there is nothing to search in the page's initial state. This module defines the small,
 * separately fetched index that fixes that — one entry per record, no facts, no display
 * configuration — and the matcher that ranks it.
 *
 * Like the rest of the engine it knows nothing about judges or courts: an entry is a name, an
 * optional secondary line and the region the record belongs to. Who builds the index decides
 * what those strings say.
 */

export const DRILLDOWN_SEARCH_SCHEMA = "pragmatic-papers/drilldown-search@1"

export interface SearchEntry {
  /** The record's `_id` — how the pane finds it again once its region's asset has loaded. */
  id: string
  /** The record's full name, as the display's `title` field gives it. */
  name: string
  /** The region the record belongs to; selecting a result selects this region. */
  region: string
}

export interface SearchIndex {
  schema: typeof DRILLDOWN_SEARCH_SCHEMA
  entries: SearchEntry[]
}

export function isSearchIndex(value: unknown): value is SearchIndex {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return v.schema === DRILLDOWN_SEARCH_SCHEMA && Array.isArray(v.entries)
}

/**
 * Casefold for comparison: diacritics stripped so "Sotomayor" finds "Sotomáyor", punctuation
 * turned into spaces so "O'Scannlain" is reachable as "oscannlain" or "o scannlain", and runs
 * of whitespace collapsed.
 */
export function normalizeQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
}

export interface SearchResult extends SearchEntry {
  /** Lower is a better match; ties fall back to the name. */
  rank: number
}

/**
 * Ranks entries against a query. A name that starts with the query beats one where a later
 * word does, which beats a match in the middle of a word — so typing "so" offers Sotomayor
 * before Alito. Every query term must appear somewhere, so "sonia soto" narrows rather than
 * widens.
 *
 * A term is also matched against the name with its separators removed, which is how someone
 * who types "oconnor" or "oscannlain" — the way the name sounds, not the way it is punctuated
 * — still finds it. Those match last.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  { limit = 8 }: { limit?: number } = {},
): SearchResult[] {
  const normalized = normalizeQuery(query)
  if (normalized === "") return []
  const terms = normalized.split(" ")
  const results: SearchResult[] = []

  for (const entry of entries) {
    const haystack = normalizeQuery(entry.name)
    const tight = haystack.replace(/ /g, "")
    let worst = 0
    let matched = true
    for (const term of terms) {
      const at = haystack.indexOf(term)
      const rank =
        at === 0 ? 0 : at > 0 ? (haystack[at - 1] === " " ? 1 : 2) : tight.includes(term) ? 3 : -1
      if (rank < 0) {
        matched = false
        break
      }
      if (rank > worst) worst = rank
    }
    if (matched) results.push({ ...entry, rank: worst })
  }

  results.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
  return results.slice(0, limit)
}
