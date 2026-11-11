// @vitest-environment node
import type { Article } from "@/payload-types"
import { describe, expect, it, vi } from "vitest"

import { grantAuthorsPublicProfile, publishedAuthors } from "../grantAuthorsPublicProfile"

const article = (fields: Partial<Article>) => ({ id: 1, ...fields }) as Article

function run(doc: Article) {
  const update = vi.fn(async () => ({ docs: [] }))
  const req = { payload: { update } }
  const result = grantAuthorsPublicProfile({ doc, req } as never)
  return { result, update, req }
}

describe("publishedAuthors", () => {
  it("credits a published article's authors", () => {
    expect(publishedAuthors(article({ _status: "published", authors: [2, 5] }))).toEqual([2, 5])
  })

  it("credits no one on a draft", () => {
    expect(publishedAuthors(article({ _status: "draft", authors: [2, 5] }))).toEqual([])
    expect(publishedAuthors(article({ authors: [2, 5] }))).toEqual([])
  })

  it("credits no one on a published article without authors", () => {
    expect(publishedAuthors(article({ _status: "published" }))).toEqual([])
    expect(publishedAuthors(article({ _status: "published", authors: null }))).toEqual([])
  })
})

describe("grantAuthorsPublicProfile", () => {
  it("gives a published article's authors a public profile, in the save's transaction", async () => {
    const doc = article({ _status: "published", authors: [2, { id: 5 } as never] })
    const { result, update, req } = run(doc)

    await expect(result).resolves.toBe(doc)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      collection: "users",
      where: { id: { in: [2, 5] }, publicProfile: { not_equals: true } },
      data: { publicProfile: true },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  it("writes nothing for a draft", async () => {
    const doc = article({ _status: "draft", authors: [2] })
    const { result, update } = run(doc)

    await expect(result).resolves.toBe(doc)
    expect(update).not.toHaveBeenCalled()
  })

  it("writes nothing for a published article without authors", async () => {
    const { result, update } = run(article({ _status: "published", authors: [] }))

    await result
    expect(update).not.toHaveBeenCalled()
  })
})
