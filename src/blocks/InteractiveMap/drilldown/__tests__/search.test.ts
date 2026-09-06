import { describe, expect, it } from "vitest"

import {
  DRILLDOWN_SEARCH_SCHEMA,
  isSearchIndex,
  normalizeQuery,
  searchEntries,
  type SearchEntry,
} from "@/blocks/InteractiveMap/drilldown/search"

const entry = (name: string, region = "ca1"): SearchEntry => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  name,
  region,
})

const entries: SearchEntry[] = [
  entry("Sonia Sotomayor", "scotus"),
  entry("Samuel A. Alito, Jr.", "scotus"),
  entry("Diarmuid F. O'Scannlain", "ca9"),
  entry("José A. Cabranes", "ca2"),
  entry("Sandra Day O'Connor", "scotus"),
]

describe("normalizeQuery", () => {
  it("casefolds, strips diacritics and turns punctuation into spaces", () => {
    expect(normalizeQuery("José A. Cabranes")).toBe("jose a cabranes")
    expect(normalizeQuery("  O'Scannlain  ")).toBe("o scannlain")
  })

  it("is empty for a query with nothing searchable in it", () => {
    expect(normalizeQuery("  ,. ")).toBe("")
  })
})

describe("searchEntries", () => {
  it("returns nothing for an empty query rather than everything", () => {
    expect(searchEntries(entries, "   ")).toEqual([])
  })

  it("ranks a name that starts with the query above a later word above mid-word", () => {
    const names = searchEntries(entries, "s").map((r) => r.name)
    expect(names.indexOf("Samuel A. Alito, Jr.")).toBeLessThan(names.indexOf("Sandra Day O'Connor"))
    // "Sotomayor" is a later word in "Sonia Sotomayor"; "O'Scannlain" only matches mid-word.
    expect(names.indexOf("Sandra Day O'Connor")).toBeLessThan(
      names.indexOf("Diarmuid F. O'Scannlain"),
    )
  })

  it("requires every term, so a second word narrows the results", () => {
    expect(searchEntries(entries, "sonia").map((r) => r.name)).toEqual(["Sonia Sotomayor"])
    expect(searchEntries(entries, "sonia soto").map((r) => r.name)).toEqual(["Sonia Sotomayor"])
    expect(searchEntries(entries, "sonia alito")).toEqual([])
  })

  it("finds a name through its diacritics and its punctuation", () => {
    expect(searchEntries(entries, "jose").map((r) => r.name)).toEqual(["José A. Cabranes"])
    expect(searchEntries(entries, "oscannlain").map((r) => r.name)).toEqual([
      "Diarmuid F. O'Scannlain",
    ])
  })

  it("carries the region so a result can be selected on the map", () => {
    expect(searchEntries(entries, "sotomayor")[0]).toMatchObject({ region: "scotus" })
  })

  it("caps the list at the requested limit", () => {
    expect(searchEntries(entries, "a", { limit: 2 })).toHaveLength(2)
  })
})

describe("isSearchIndex", () => {
  it("accepts an index carrying the schema and rejects anything else", () => {
    expect(isSearchIndex({ schema: DRILLDOWN_SEARCH_SCHEMA, entries: [] })).toBe(true)
    expect(isSearchIndex({ schema: "something/else@1", entries: [] })).toBe(false)
    expect(isSearchIndex({ schema: DRILLDOWN_SEARCH_SCHEMA })).toBe(false)
    expect(isSearchIndex(null)).toBe(false)
  })
})
