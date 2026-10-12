// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import { readersChange, rememberReadersCopy } from "../readersCopy"
import { draftsCollection, readersRow } from "./readersCopyHelpers"

const articles = draftsCollection("articles")
const topics = { slug: "topics", versions: undefined }

interface Row {
  id: number
  slug: string
  _status: "draft" | "published"
}
const published = (slug: string): Row => ({ id: 1, slug, _status: "published" })
const draft = (slug: string): Row => ({ id: 1, slug, _status: "draft" })

const makeReq = (findByID: ReturnType<typeof vi.fn>, context: Record<string, unknown> = {}) =>
  ({ payload: { findByID }, context }) as never

/** Runs a save through both hooks: `row` is the collection's row before and after it. */
async function save({
  doc,
  previousDoc,
  rowBefore,
  rowAfter,
}: {
  doc: Row
  previousDoc: Row
  rowBefore: Row
  rowAfter: Row
}) {
  const findByID = vi.fn().mockResolvedValueOnce(rowBefore).mockResolvedValue(rowAfter)
  const req = makeReq(findByID)
  await rememberReadersCopy({
    collection: articles,
    data: doc,
    operation: "update",
    originalDoc: previousDoc,
    req,
  } as never)
  return readersChange({ collection: articles, doc, previousDoc, req } as never)
}

describe("readersChange", () => {
  it("sees no change for an autosave over a published document", async () => {
    const change = await save({
      doc: draft("a"),
      previousDoc: published("a"),
      rowBefore: published("a"),
      rowAfter: published("a"),
    })
    expect(change).toBeNull()
  })

  it("compares a publish after autosaves with the copy readers had, not the draft", async () => {
    const change = await save({
      doc: published("a"),
      previousDoc: draft("a"),
      rowBefore: published("a"),
      rowAfter: published("a"),
    })
    expect(change).toEqual({ before: published("a"), after: published("a") })
  })

  it("follows a rename made in drafts and then published", async () => {
    const change = await save({
      doc: published("b"),
      previousDoc: draft("b"),
      rowBefore: published("a"),
      rowAfter: published("b"),
    })
    expect(change).toEqual({ before: published("a"), after: published("b") })
  })

  it("reports an unpublish", async () => {
    const change = await save({
      doc: draft("a"),
      previousDoc: draft("a"),
      rowBefore: published("a"),
      rowAfter: draft("a"),
    })
    expect(change).toEqual({ before: published("a"), after: null })
  })

  it("reports a first publish", async () => {
    const change = await save({
      doc: published("a"),
      previousDoc: draft("a"),
      rowBefore: draft("a"),
      rowAfter: published("a"),
    })
    expect(change).toEqual({ before: null, after: published("a") })
  })

  it("sees no change for a draft of something never published", async () => {
    const change = await save({
      doc: draft("a"),
      previousDoc: draft("a"),
      rowBefore: draft("a"),
      rowAfter: draft("a"),
    })
    expect(change).toBeNull()
  })

  it("falls back to previousDoc when nothing was remembered", async () => {
    const req = makeReq(readersRow())
    const change = await readersChange({
      collection: articles,
      doc: published("b"),
      previousDoc: published("a"),
      req,
    } as never)
    expect(change).toEqual({ before: published("a"), after: published("b") })
  })

  it("sees nothing before a create, whose previousDoc is empty", async () => {
    const req = makeReq(readersRow())
    const change = await readersChange({
      collection: articles,
      doc: published("a"),
      previousDoc: {},
      req,
    } as never)
    expect(change).toEqual({ before: null, after: published("a") })
  })

  it("treats a row it can't read as one readers can't see", async () => {
    const req = makeReq(vi.fn().mockRejectedValue(new Error("not found")))
    const change = await readersChange({
      collection: articles,
      doc: draft("a"),
      previousDoc: published("a"),
      req,
    } as never)
    expect(change).toEqual({ before: published("a"), after: null })
  })

  it("compares a collection without drafts as saved", async () => {
    const findByID = vi.fn()
    const change = await readersChange({
      collection: topics,
      doc: { id: 2, slug: "econ" },
      previousDoc: { id: 2, slug: "economics" },
      req: makeReq(findByID),
    } as never)
    expect(change).toEqual({ before: { id: 2, slug: "economics" }, after: { id: 2, slug: "econ" } })
    expect(findByID).not.toHaveBeenCalled()
  })
})

describe("rememberReadersCopy", () => {
  it("reads the row readers see, not the latest version", async () => {
    const findByID = readersRow({ slug: "a", _status: "published" })
    const data = { title: "x" }
    const result = await rememberReadersCopy({
      collection: articles,
      data,
      operation: "update",
      originalDoc: draft("a"),
      req: makeReq(findByID),
    } as never)
    expect(result).toBe(data)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "articles", id: 1, draft: false }),
    )
  })

  it("keeps what it read when the read swaps req.context, as Payload's Local API does", async () => {
    const req = { payload: {}, context: {} } as { payload: object; context: object }
    req.payload = {
      findByID: vi.fn(async () => {
        req.context = { ...req.context }
        return published("a")
      }),
    }
    await rememberReadersCopy({
      collection: articles,
      data: {},
      operation: "update",
      originalDoc: draft("a"),
      req,
    } as never)
    const change = await readersChange({
      collection: articles,
      doc: published("a"),
      previousDoc: draft("a"),
      req,
    } as never)
    expect(change).toEqual({ before: published("a"), after: published("a") })
  })

  it("reads nothing on create, without drafts, or when revalidation is off", async () => {
    const findByID = vi.fn()
    const base = { data: {}, originalDoc: draft("a") }
    await rememberReadersCopy({
      ...base,
      collection: articles,
      operation: "create",
      req: makeReq(findByID),
    } as never)
    await rememberReadersCopy({
      ...base,
      collection: topics,
      operation: "update",
      req: makeReq(findByID),
    } as never)
    await rememberReadersCopy({
      ...base,
      collection: articles,
      operation: "update",
      req: makeReq(findByID, { disableRevalidate: true }),
    } as never)
    expect(findByID).not.toHaveBeenCalled()
  })
})
