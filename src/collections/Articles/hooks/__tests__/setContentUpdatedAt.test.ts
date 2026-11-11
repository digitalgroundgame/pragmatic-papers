// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readerContentChanged, setContentUpdatedAt } from "../setContentUpdatedAt"

const content = (text: string) => ({
  root: {
    type: "root",
    version: 1,
    children: [{ type: "paragraph", version: 1, children: [{ type: "text", text }] }],
  },
})

describe("readerContentChanged", () => {
  it("ignores key order, which Postgres's jsonb doesn't keep", () => {
    const stored = { root: { version: 1, children: content("Hi").root.children, type: "root" } }

    expect(
      readerContentChanged({ content: stored as never }, { content: content("Hi") as never }),
    ).toBe(false)
  })

  it("treats a populated relationship as the document it points at", () => {
    const populated = { id: 7, name: "Ada", createdAt: "x", updatedAt: "y" }

    expect(
      readerContentChanged(
        { authors: [7], heroImage: 3 },
        {
          authors: [populated as never],
          heroImage: { id: 3, updatedAt: "y" } as never,
        },
      ),
    ).toBe(false)
  })

  it("treats a missing value as empty", () => {
    expect(readerContentChanged({ heroImage: null }, {})).toBe(false)
  })

  it("sees a changed title, text, hero image, author list or narration", () => {
    expect(readerContentChanged({ title: "A" }, { title: "B" })).toBe(true)
    expect(
      readerContentChanged({ content: content("A") as never }, { content: content("B") as never }),
    ).toBe(true)
    expect(readerContentChanged({ heroImage: 1 }, { heroImage: 2 })).toBe(true)
    expect(readerContentChanged({ authors: [1, 2] }, { authors: [2, 1] })).toBe(true)
    expect(readerContentChanged({ narration: null }, { narration: 4 })).toBe(true)
  })

  it("leaves out fields readers don't see on the page", () => {
    expect(
      readerContentChanged(
        { title: "A", syndicateToSubstack: false, topics: [1] } as never,
        { title: "A", syndicateToSubstack: true, topics: [2] } as never,
      ),
    ).toBe(false)
  })
})

const KEPT = "2026-01-01T00:00:00.000Z"
const PUBLISHED_AT = "2026-01-01T00:00:00.000Z"
const NOW = "2026-06-01T12:00:00.000Z"

/** The article's row as readers are served it: published, with its reader fields. */
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  _status: "published",
  contentUpdatedAt: KEPT,
  title: "Headline",
  content: content("Body"),
  heroImage: 3,
  authors: [7],
  narration: null,
  ...overrides,
})

function run({
  stored = row(),
  siblingData = {},
  originalDoc = row(),
  operation = "update",
}: {
  stored?: Record<string, unknown> | Error
  siblingData?: Record<string, unknown>
  originalDoc?: Record<string, unknown> | undefined
  operation?: "create" | "update"
} = {}) {
  const findByID = vi.fn(() =>
    stored instanceof Error ? Promise.reject(stored) : Promise.resolve(stored),
  )
  const result = setContentUpdatedAt({
    operation,
    originalDoc,
    req: { payload: { findByID } },
    siblingData,
  } as never)
  return { result, findByID }
}

describe("setContentUpdatedAt", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("reads the copy readers are served, not the latest draft", async () => {
    const { result, findByID } = run({ siblingData: { _status: "published" } })
    await result

    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "articles", id: 1, draft: false, depth: 0 }),
    )
  })

  it("starts at publishedAt when an article is created published", async () => {
    const { result, findByID } = run({
      operation: "create",
      originalDoc: undefined,
      siblingData: { _status: "published", publishedAt: PUBLISHED_AT },
    })

    expect(await result).toBe(PUBLISHED_AT)
    expect(findByID).not.toHaveBeenCalled()
  })

  it("falls back to now when a first publish has no publishedAt", async () => {
    const { result } = run({ operation: "create", siblingData: { _status: "published" } })

    expect(await result).toBe(NOW)
  })

  it("leaves a draft created never published without a date", async () => {
    const { result } = run({ operation: "create", siblingData: { _status: "draft" } })

    expect(await result).toBeNull()
  })

  it("carries the published value along on a draft save, even one that edits the title", async () => {
    const { result } = run({ siblingData: { _status: "draft", title: "Typed into" } })

    expect(await result).toBe(KEPT)
  })

  it("starts at publishedAt on the first publish of an existing draft", async () => {
    const { result } = run({
      stored: row({ _status: "draft", contentUpdatedAt: null }),
      siblingData: { _status: "published", publishedAt: PUBLISHED_AT },
    })

    expect(await result).toBe(PUBLISHED_AT)
  })

  it("treats an article whose row can't be read as never published", async () => {
    const { result } = run({
      stored: new Error("not found"),
      siblingData: { _status: "published", publishedAt: PUBLISHED_AT },
    })

    expect(await result).toBe(PUBLISHED_AT)
  })

  it("keeps the date when a publish changes only fields readers don't see", async () => {
    const { result } = run({
      siblingData: { ...row(), syndicateToSubstack: true, topics: [9] },
    })

    expect(await result).toBe(KEPT)
  })

  it("moves the date to now when a publish changes what readers see", async () => {
    const { result } = run({ siblingData: { ...row(), title: "New headline" } })

    expect(await result).toBe(NOW)
  })

  it("ignores a date the save sends", async () => {
    const { result } = run({ siblingData: { ...row(), contentUpdatedAt: "2020-01-01" } })

    expect(await result).toBe(KEPT)
  })

  it("fills fields a partial save leaves out from the document, and its status too", async () => {
    // A Local API save sending only the checkbox: status and content come from the document.
    const unchanged = run({ siblingData: { syndicateToSubstack: true } })
    expect(await unchanged.result).toBe(KEPT)

    // The draft being published holds an autosaved edit the row doesn't have yet.
    const edited = run({
      originalDoc: row({ title: "Autosaved headline" }),
      siblingData: { syndicateToSubstack: true },
    })
    expect(await edited.result).toBe(NOW)
  })
})
