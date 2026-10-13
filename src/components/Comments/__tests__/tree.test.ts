import { describe, expect, it } from "vitest"

import { threadComments } from "@/stories/fixtures/comments"

import { buildTree, visibleCount } from "../tree"

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
