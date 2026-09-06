"use client"

import React, { useCallback, useEffect, useId, useRef, useState } from "react"

import { cn } from "@/utilities/utils"

import { isSearchIndex, searchEntries, type SearchEntry, type SearchResult } from "./search"
import type { RegionIndex } from "./types"

interface DrilldownSearchProps {
  /** Same-origin route serving the index; fetched once, on the reader's first query. */
  url: string
  regions: RegionIndex
  /** Placeholder and accessible name, in the interactive's own vocabulary. */
  label?: string
  onSelect(result: SearchResult): void
  className?: string
}

type IndexState = "idle" | "loading" | "ready" | "error"

const MAX_RESULTS = 8

/**
 * Finds a record anywhere in the drilldown by name and takes the reader to it, without their
 * having to know which region it sits in — the one thing the map cannot answer.
 *
 * A combobox rather than a filter box: the list is the result, the arrow keys walk it, Enter
 * commits, Escape steps back out. The index is fetched on the first keystroke and held for
 * the life of the page, so the cost lands on readers who search and on nobody else.
 */
export function DrilldownSearch({
  url,
  regions,
  label = "Search records",
  onSelect,
  className,
}: DrilldownSearchProps): React.ReactElement {
  const inputId = useId()
  const listId = `${inputId}-results`
  const inputRef = useRef<HTMLInputElement | null>(null)
  const entriesRef = useRef<SearchEntry[] | null>(null)
  const pending = useRef<Promise<void> | null>(null)

  const [query, setQuery] = useState("")
  const [state, setState] = useState<IndexState>("idle")
  const [results, setResults] = useState<SearchResult[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)

  const loadIndex = useCallback(async (): Promise<void> => {
    if (entriesRef.current) return
    if (pending.current) return pending.current
    const run = (async () => {
      setState("loading")
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body: unknown = await res.json()
        if (!isSearchIndex(body)) throw new Error("unrecognised search index")
        entriesRef.current = body.entries
        setState("ready")
      } catch (err) {
        console.error("[interactive-map] failed to load the search index:", err)
        setState("error")
      } finally {
        pending.current = null
      }
    })()
    pending.current = run
    return run
  }, [url])

  // Re-rank whenever the query changes or the index finishes loading behind it.
  useEffect(() => {
    const entries = entriesRef.current
    if (!entries || query.trim() === "") {
      setResults([])
      setActive(0)
      return
    }
    setResults(searchEntries(entries, query, { limit: MAX_RESULTS }))
    setActive(0)
  }, [query, state])

  const commit = (result: SearchResult | undefined): void => {
    if (!result) return
    onSelect(result)
    setOpen(false)
    setQuery("")
    setResults([])
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Escape") {
      // First Escape dismisses the list; a second clears the box, so the key never escapes
      // to the map and closes the pane the reader just opened.
      e.stopPropagation()
      if (open && results.length > 0) setOpen(false)
      else setQuery("")
      return
    }
    if (results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      commit(results[active])
    } else if (e.key === "Home") {
      setActive(0)
    } else if (e.key === "End") {
      setActive(results.length - 1)
    }
  }

  const showList = open && query.trim() !== ""
  const activeId = showList && results[active] ? `${listId}-${active}` : undefined

  return (
    <div data-drilldown-search="" className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={activeId}
        placeholder={label}
        value={query}
        onFocus={() => void loadIndex()}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          void loadIndex()
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className={cn(
          "border-border bg-background text-foreground placeholder:text-muted-foreground",
          "focus-visible:ring-ring/60 w-full rounded-md border px-3 py-1.5 text-sm outline-none",
          "focus-visible:ring-2 [&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {showList && (
        <div
          className={cn(
            "border-border bg-card absolute z-20 mt-1 w-full overflow-hidden rounded-md border shadow-lg",
          )}
        >
          {state === "loading" && results.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm" data-drilldown-search-loading="">
              Loading…
            </p>
          )}
          {state === "error" && (
            <p className="text-destructive px-3 py-2 text-sm" data-drilldown-search-error="">
              Search is unavailable.
            </p>
          )}
          {state === "ready" && results.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm" data-drilldown-search-empty="">
              No matches.
            </p>
          )}
          {results.length > 0 && (
            <ul id={listId} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto">
              {results.map((r, i) => (
                <li key={r.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    data-drilldown-search-result={r.id}
                    // The input keeps focus, so the blur that would close the list has to be
                    // suppressed before the click can land.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(r)}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm",
                      i === active ? "bg-muted text-foreground" : "text-foreground",
                    )}
                  >
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {regions.byId[r.region]?.label ?? r.region}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
