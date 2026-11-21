import type { Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { Article } from "@/payload-types"
import { createArticle } from "./helpers/content"
import { createUser, getPayload } from "./helpers/testUsers"

// An article's "Updated" time moves only when readers see the article change: a published
// save that ticks Syndicate to Substack keeps it, and an autosaved edit moves it only once
// it's published. Driven through Payload's real versions, as the admin saves them.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache: vi.fn() }))

let payload: Payload
let author: number

beforeAll(async () => {
  payload = await getPayload()
  author = (await createUser("writer")).id
})

/** What readers are served: the article's own row. */
const readersCopy = (id: number) =>
  payload.findByID({ collection: "articles", id, draft: false, depth: 0, overrideAccess: true })

/** The whole document, as the admin's form submits it on Publish. */
async function publishWith(id: number, changes: Partial<Article>, depth = 0): Promise<Article> {
  const current = await payload.findByID({
    collection: "articles",
    id,
    draft: true,
    depth,
    overrideAccess: true,
  })
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = current
  return payload.update({
    collection: "articles",
    id,
    overrideAccess: true,
    data: { ...fields, ...changes, _status: "published" },
  })
}

describe("contentUpdatedAt", () => {
  it("starts at publishedAt on the first publish", async () => {
    const article = await createArticle({ authors: [author] })

    expect(article.contentUpdatedAt).toBe(article.publishedAt)
  })

  it("stays put when a published save changes nothing readers see", async () => {
    const article = await createArticle({ authors: [author] })

    const ticked = await publishWith(article.id, { syndicateToSubstack: true })
    expect(ticked.updatedAt).not.toBe(article.updatedAt)
    expect(ticked.contentUpdatedAt).toBe(article.contentUpdatedAt)

    // The admin's form can carry populated relationships; they're the same documents.
    const populated = await publishWith(article.id, { syndicateToSubstack: false }, 1)
    expect(populated.contentUpdatedAt).toBe(article.contentUpdatedAt)
  })

  it("moves when a published save changes the title", async () => {
    const article = await createArticle({ authors: [author] })

    const renamed = await publishWith(article.id, { title: "A new headline" })

    expect(renamed.contentUpdatedAt).not.toBe(article.contentUpdatedAt)
    expect(Date.parse(renamed.contentUpdatedAt!)).toBeGreaterThan(
      Date.parse(article.contentUpdatedAt!),
    )
  })

  it("moves when the authors change", async () => {
    const article = await createArticle({ authors: [author] })
    const coauthor = (await createUser("writer")).id

    const credited = await publishWith(article.id, { authors: [author, coauthor] })

    expect(credited.contentUpdatedAt).not.toBe(article.contentUpdatedAt)
  })

  it("waits for an autosaved edit to be published", async () => {
    const article = await createArticle({ authors: [author] })

    await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      draft: true,
      autosave: true,
      data: { title: "Typed into" },
    })
    expect((await readersCopy(article.id)).contentUpdatedAt).toBe(article.contentUpdatedAt)

    // The draft already holds the new title; readers' copy doesn't, so publishing it is a change.
    const published = await publishWith(article.id, {})
    expect(published.title).toBe("Typed into")
    expect(published.contentUpdatedAt).not.toBe(article.contentUpdatedAt)
  })

  it("is set by the server, not by what a save sends", async () => {
    const article = await createArticle({ authors: [author] })

    const sent = await publishWith(article.id, { contentUpdatedAt: "2020-01-01T00:00:00.000Z" })

    expect(sent.contentUpdatedAt).toBe(article.contentUpdatedAt)
  })
})
