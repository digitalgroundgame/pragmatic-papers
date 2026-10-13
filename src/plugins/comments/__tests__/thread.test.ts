import { describe, expect, it } from "vitest"

import { buildThread, type StoredComment } from "../thread"
import type { CommentAuthor } from "../types"

const ada = { id: 1, name: "Ada" }
const bob = { id: 2, name: "Bob" }
const describeAuthor = (author: CommentAuthor) => ({
  name: String(author.name),
  image: null,
  badge: null,
})

const comment = (id: number, overrides: Partial<StoredComment> = {}): StoredComment => ({
  id,
  body: `Comment ${id}`,
  createdAt: `2026-10-0${id}T00:00:00.000Z`,
  status: "published",
  depth: 0,
  parent: null,
  author: ada,
  ...overrides,
})

const ids = (comments: ReturnType<typeof buildThread>) => comments.map(({ id }) => id)

describe("buildThread", () => {
  it("returns published comments with their parent, depth and author", () => {
    const thread = buildThread(
      [comment(1), comment(2, { parent: 1, depth: 1, author: bob })],
      null,
      describeAuthor,
    )
    expect(thread).toEqual([
      {
        id: 1,
        parentId: null,
        depth: 0,
        body: "Comment 1",
        createdAt: "2026-10-01T00:00:00.000Z",
        author: { name: "Ada", image: null, badge: null },
      },
      expect.objectContaining({
        id: 2,
        parentId: 1,
        depth: 1,
        author: expect.objectContaining({ name: "Bob" }),
      }),
    ])
  })

  it("leaves out what nobody should see and nothing hangs from", () => {
    const thread = buildThread(
      [comment(1, { status: "hidden" }), comment(2, { status: "deleted", author: null })],
      null,
      describeAuthor,
    )
    expect(thread).toEqual([])
  })

  it("keeps a placeholder for a removed comment whose replies still show", () => {
    const thread = buildThread(
      [
        comment(1, { status: "hidden" }),
        comment(2, { parent: 1, depth: 1, status: "deleted", author: null }),
        comment(3, { parent: 2, depth: 2, author: bob }),
      ],
      null,
      describeAuthor,
    )
    expect(ids(thread)).toEqual([1, 2, 3])
    expect(thread[0]).toEqual({
      id: 1,
      parentId: null,
      depth: 0,
      createdAt: "2026-10-01T00:00:00.000Z",
      body: "",
      author: null,
      removed: true,
    })
    expect(thread[1]).toMatchObject({ removed: true, body: "" })
  })

  it("shows a held comment to its author alone, marked", () => {
    const stored = [comment(1, { status: "auto-hidden", author: { id: 1, name: "Ada" } })]
    expect(buildThread(stored, null, describeAuthor)).toEqual([])
    expect(buildThread(stored, 2, describeAuthor)).toEqual([])
    expect(buildThread(stored, "1", describeAuthor)).toEqual([
      expect.objectContaining({ id: 1, held: true, body: "Comment 1" }),
    ])
  })

  it("never shows a hidden comment's words, even to its author", () => {
    const stored = [comment(1, { status: "hidden" }), comment(2, { parent: 1, depth: 1 })]
    expect(buildThread(stored, 1, describeAuthor)[0]).toMatchObject({ removed: true, body: "" })
  })
})
