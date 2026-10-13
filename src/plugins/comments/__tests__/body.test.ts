import { describe, expect, it } from "vitest"

import { normalizeCommentBody } from "../body"

describe("normalizeCommentBody", () => {
  it("trims, normalizes line breaks and keeps at most one blank line", () => {
    expect(normalizeCommentBody("  one  \r\ntwo\r\n\r\n\r\n\nthree\t ", 100)).toEqual({
      ok: true,
      body: "one\ntwo\n\nthree",
    })
  })

  it("drops control characters but keeps tabs inside a line", () => {
    expect(normalizeCommentBody("a\u0000b\u0007c\td", 100)).toEqual({ ok: true, body: "abc\td" })
  })

  it("refuses anything that isn't text, or is only whitespace", () => {
    expect(normalizeCommentBody(undefined, 100).ok).toBe(false)
    expect(normalizeCommentBody(42, 100).ok).toBe(false)
    expect(normalizeCommentBody(" \n\t ", 100)).toEqual({
      ok: false,
      message: "Write a comment first.",
    })
  })

  it("refuses a comment over the limit, counted after tidying", () => {
    expect(normalizeCommentBody("abcd", 3)).toEqual({
      ok: false,
      message: "Comments can be at most 3 characters.",
    })
    expect(normalizeCommentBody("  abc  ", 3)).toEqual({ ok: true, body: "abc" })
  })
})
