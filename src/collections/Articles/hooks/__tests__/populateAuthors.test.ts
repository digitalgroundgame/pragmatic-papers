import type { Article, User } from "@/payload-types"
import type { CollectionAfterReadHook } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { populateAuthors } from "../populateAuthors"

type HookArgs = Parameters<CollectionAfterReadHook<Article>>[0]

const find = vi.fn()
const error = vi.fn()

const makeArgs = (doc: Partial<Article>, context: Record<string, unknown> = {}): HookArgs =>
  ({
    doc,
    req: { payload: { find, logger: { error } }, context },
  }) as unknown as HookArgs

const makeUser = (id: number, name: string): User =>
  ({ id, name, slug: `author-${id}` }) as unknown as User

const run = (doc: Partial<Article>, context: Record<string, unknown> = {}) =>
  populateAuthors(makeArgs(doc, context)) as Promise<Article>

describe("populateAuthors afterRead hook", () => {
  beforeEach(() => {
    find.mockReset()
    error.mockReset()
  })

  it("resolves bare author IDs into user documents", async () => {
    find.mockResolvedValue({ docs: [makeUser(2, "Jane Doe"), makeUser(1, "John Smith")] })

    const doc = await run({ id: 10, authors: [1, 2] })

    expect(find).toHaveBeenCalledTimes(1)
    expect(doc.authors).toEqual([makeUser(1, "John Smith"), makeUser(2, "Jane Doe")])
  })

  it("preserves the original author order", async () => {
    find.mockResolvedValue({
      docs: [makeUser(7, "Third"), makeUser(3, "First"), makeUser(5, "Second")],
    })

    const doc = await run({ id: 10, authors: [3, 5, 7] })

    expect((doc.authors as User[]).map((author) => author.name)).toEqual([
      "First",
      "Second",
      "Third",
    ])
  })

  it("never selects email or roles", async () => {
    find.mockResolvedValue({ docs: [makeUser(1, "Jane Doe")] })

    await run({ id: 10, authors: [1] })

    const select = find.mock.calls[0]?.[0]?.select
    expect(select).toBeDefined()
    expect(select).not.toHaveProperty("email")
    expect(select).not.toHaveProperty("roles")
    expect(select).toHaveProperty("name", true)
  })

  it("skips the query when every author is already populated", async () => {
    const authors = [makeUser(1, "Jane Doe"), makeUser(2, "John Smith")]

    const doc = await run({ id: 10, authors })

    expect(find).not.toHaveBeenCalled()
    expect(doc.authors).toBe(authors)
  })

  it("fetches only the unresolved IDs and leaves populated authors untouched", async () => {
    // Payload leaves a bare ID when a related user fails the read check; the
    // authors it did populate have already been through field-level access.
    const populated = makeUser(1, "Jane Doe")
    find.mockResolvedValue({ docs: [makeUser(2, "John Smith")] })

    const doc = await run({ id: 10, authors: [populated, 2] })

    expect(find.mock.calls[0]?.[0]?.where).toEqual({ id: { in: [2] } })
    expect((doc.authors as User[])[0]).toBe(populated)
    expect((doc.authors as User[])[1]).toEqual(makeUser(2, "John Smith"))
  })

  it("drops IDs that no longer resolve to a user", async () => {
    find.mockResolvedValue({ docs: [makeUser(1, "Jane Doe")] })

    const doc = await run({ id: 10, authors: [1, 999] })

    expect(doc.authors).toEqual([makeUser(1, "Jane Doe")])
  })

  it("returns the doc untouched when skipAfterRead is set", async () => {
    const doc = await run({ id: 10, authors: [1, 2] }, { skipAfterRead: true })

    expect(find).not.toHaveBeenCalled()
    expect(doc.authors).toEqual([1, 2])
  })

  it("returns the doc untouched when there are no authors", async () => {
    await run({ id: 10, authors: [] })
    await run({ id: 10 })

    expect(find).not.toHaveBeenCalled()
  })

  it("logs and returns the doc when the query fails", async () => {
    find.mockRejectedValue(new Error("db down"))

    const doc = await run({ id: 10, authors: [1] })

    expect(error).toHaveBeenCalledOnce()
    expect(doc.authors).toEqual([1])
  })
})
