import { describe, expect, it } from "vitest"

import { threadComments } from "@/stories/fixtures/comments"

import { buildTree, replyCount, sortRoots, visibleCount } from "../tree"

describe("buildTree", () => {
  it("nests each reply under its parent, keeping order", () => {
    const tree = buildTree(threadComments)
    expect(tree.map(({ comment }) => comment.id)).toEqual([1, 3])
    expect(tree[0]!.replies.map(({ comment }) => comment.id)).toEqual([2])
    expect(tree[1]!.replies.map(({ comment }) => comment.id)).toEqual([4])
  })

  it("shows a reply whose parent is missing at the top level", () => {
    const [orphan] = buildTree([{ ...threadComments[1]!, parentId: 999 }])
    expect(orphan?.comment.id).toBe(2)
  })
})

describe("visibleCount", () => {
  it("leaves out placeholders", () => {
    expect(visibleCount(threadComments)).toBe(3)
  })
})

describe("sortRoots", () => {
  const ids = (nodes: ReturnType<typeof buildTree>) => nodes.map(({ comment }) => comment.id)
  // Ten top-level comments, an hour apart, oldest first, the first with a reply.
  const many = Array.from({ length: 10 }, (_, i) => ({
    ...threadComments[0]!,
    id: i + 1,
    createdAt: new Date(Date.UTC(2026, 10, 1, i)).toISOString(),
  }))
  const tree = buildTree([...many, { ...threadComments[1]!, id: 99, parentId: 1 }])

  it("puts top-level comments oldest or newest first", () => {
    expect(ids(sortRoots(tree, "old", ""))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(ids(sortRoots(tree, "new", ""))).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  })

  it("shuffles the same way for the same seed, and differently for another", () => {
    const once = ids(sortRoots(tree, "random", "reader-a"))
    expect(ids(sortRoots(tree, "random", "reader-a"))).toEqual(once)
    expect([...once].sort((a, b) => Number(a) - Number(b))).toEqual(ids(tree))
    expect(ids(sortRoots(tree, "random", "reader-b"))).not.toEqual(once)
  })

  it("leaves replies where they are", () => {
    const sorted = sortRoots(tree, "random", "reader-a")
    expect(ids(sorted.find(({ comment }) => comment.id === 1)!.replies)).toEqual([99])
  })

  it("puts pinned comments first, newest first, whatever the order", () => {
    expect(ids(sortRoots(tree, "old", "", new Set(["3", "7"]))).slice(0, 3)).toEqual([7, 3, 1])
  })

  it("doesn't change the list it's given", () => {
    sortRoots(tree, "new", "")
    expect(ids(tree)[0]).toBe(1)
  })
})

describe("replyCount", () => {
  it("counts replies at every depth, leaving out placeholders", () => {
    const nested = buildTree([
      threadComments[0]!,
      { ...threadComments[1]!, id: 2, parentId: 1 },
      { ...threadComments[1]!, id: 5, parentId: 2, depth: 2 },
      { ...threadComments[2]!, id: 6, parentId: 1, depth: 1 },
    ])
    expect(replyCount(nested[0]!)).toBe(2)
  })
})
