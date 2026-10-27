import type { Access, PayloadRequest } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DocSuggestions, recordResolution } from "../suggestionsCollection"

const req = (roles?: string[]) =>
  ({ user: roles ? { id: 7, collection: "users", roles } : null }) as unknown as PayloadRequest
const access = (op: "create" | "read" | "update" | "delete") => DocSuggestions.access![op] as Access

describe("DocSuggestions access", () => {
  it("lets editors read and close suggestions, and nobody create one", () => {
    expect(access("read")({ req: req(["editor"]) })).toBe(true)
    expect(access("update")({ req: req(["editor"]) })).toBe(true)
    expect(access("read")({ req: req(["writer"]) })).toBe(false)
    expect(access("update")({ req: req() })).toBe(false)
    expect(access("create")({ req: req(["admin"]) })).toBe(false)
  })

  it("lets only admins delete one", () => {
    expect(access("delete")({ req: req(["admin"]) })).toBe(true)
    expect(access("delete")({ req: req(["editor"]) })).toBe(false)
  })
})

describe("recordResolution", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-27T12:00:00Z") }))
  afterEach(() => vi.useRealTimers())

  const run = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
    recordResolution({ data, originalDoc, req: req(["editor"]) } as never)

  it("records who closed a suggestion and when", () => {
    expect(run({ status: "resolved" }, { status: "open" })).toEqual({
      status: "resolved",
      resolvedBy: 7,
      resolvedAt: "2026-10-27T12:00:00.000Z",
    })
    expect(run({ status: "dismissed" }, { status: "open" })).toMatchObject({ resolvedBy: 7 })
  })

  it("clears both when it's opened again", () => {
    expect(run({ status: "open" }, { status: "resolved", resolvedBy: 7 })).toEqual({
      status: "open",
      resolvedBy: null,
      resolvedAt: null,
    })
  })

  it("leaves a save that doesn't change the status alone", () => {
    expect(run({ status: "open", note: "x" }, { status: "open" })).toEqual({
      status: "open",
      note: "x",
    })
    expect(run({ title: "x" }, { status: "open" })).toEqual({ title: "x" })
  })
})
