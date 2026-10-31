import type { PayloadRequest } from "payload"
import { describe, expect, it, vi } from "vitest"

import { countLinks, duplicateCheck, linkCheck, runChecks } from "../checks"
import { DEFAULT_SETTINGS } from "../constants"
import type { CommentCheckArgs } from "../types"

const count = vi.fn()
const args = (overrides: Partial<CommentCheckArgs> = {}): CommentCheckArgs => ({
  body: "Hello",
  author: { id: 7 },
  targetId: 1,
  settings: { ...DEFAULT_SETTINGS },
  req: { payload: { count } } as unknown as PayloadRequest,
  ...overrides,
})

describe("countLinks", () => {
  it.each([
    ["no links here", 0],
    ["see https://a.test and http://b.test", 2],
    ["www.example.com", 1],
    ["HTTPS://SHOUT.TEST", 1],
  ])("%j has %i", (body, expected) => {
    expect(countLinks(body)).toBe(expected)
  })
})

describe("linkCheck", () => {
  it("holds a comment with more links than allowed", async () => {
    const body = "https://a.test https://b.test https://c.test"
    expect(await linkCheck(args({ body }))).toEqual({ ok: false, reason: "More than 2 links" })
    expect(await linkCheck(args({ body, settings: { ...DEFAULT_SETTINGS, maxLinks: 3 } }))).toEqual(
      {
        ok: true,
      },
    )
  })
})

describe("duplicateCheck", () => {
  it("holds what the author posted word for word in the past day", async () => {
    count.mockResolvedValue({ totalDocs: 1 })
    expect(await duplicateCheck(args())).toEqual({
      ok: false,
      reason: "Repeats an earlier comment",
    })
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ author: { equals: 7 }, body: { equals: "Hello" } }),
      }),
    )
  })

  it("passes a first comment, and everything while switched off", async () => {
    count.mockResolvedValue({ totalDocs: 0 })
    expect(await duplicateCheck(args())).toEqual({ ok: true })

    count.mockClear()
    const off = args({ settings: { ...DEFAULT_SETTINGS, blockDuplicates: false } })
    expect(await duplicateCheck(off)).toEqual({ ok: true })
    expect(count).not.toHaveBeenCalled()
  })
})

describe("runChecks", () => {
  it("stops at the first check that fails", async () => {
    const later = vi.fn()
    const result = await runChecks(
      [() => ({ ok: true }), () => ({ ok: false, reason: "No" }), later],
      args(),
    )
    expect(result).toEqual({ ok: false, reason: "No" })
    expect(later).not.toHaveBeenCalled()
  })
})
