import { describe, expect, it } from "vitest"

import { getFootnotes } from "../utils"

describe("getFootnotes", () => {
  it("returns the footnotes array as-is when it's a valid array", () => {
    const footnotes = [{ note: "Ibid.", attributionEnabled: false }]

    expect(getFootnotes({ footnotes })).toBe(footnotes)
  })

  it("returns an empty array when data is undefined", () => {
    expect(getFootnotes(undefined)).toEqual([])
  })

  it("returns an empty array when footnotes is missing from data", () => {
    expect(getFootnotes({})).toEqual([])
  })

  it("returns an empty array when footnotes is null", () => {
    expect(getFootnotes({ footnotes: null })).toEqual([])
  })

  it("returns an empty array when footnotes is not an array", () => {
    // Guards the boundary: useDocumentInfo()'s `data` is untyped admin form
    // state, so a malformed shape shouldn't crash callers that call .find()/.filter().
    expect(getFootnotes({ footnotes: "not an array" })).toEqual([])
    expect(getFootnotes({ footnotes: { note: "not wrapped in an array" } })).toEqual([])
  })
})
