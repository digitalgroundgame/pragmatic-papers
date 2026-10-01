import { describe, expect, it } from "vitest"

import { getFootnotes, truncate } from "../utils"

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

describe("truncate", () => {
  it("leaves text at or under the limit alone", () => {
    expect(truncate("short", 10)).toBe("short")
    expect(truncate("exactly10!", 10)).toBe("exactly10!")
    expect(truncate("", 0)).toBe("")
  })

  it("cuts longer text at the limit and adds an ellipsis", () => {
    expect(truncate("A long footnote about something", 6)).toBe("A long…")
  })

  it("leaves only the ellipsis at a zero limit", () => {
    expect(truncate("abc", 0)).toBe("…")
  })
})
