import type { Payload } from "payload"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"
import { createArticle, createVolume } from "../helpers/content"
import { createUser, getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { revalidatePath } = await import("next/cache")

/**
 * The article hooks in `src/collections/Articles/hooks/revalidateArticle.ts`, run by Payload
 * itself against a real database: the part a unit test can't reach is the `articles.id` query
 * that finds the volumes listing the article.
 */
let payload: Payload
let author: User

const paths = (): string[] => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const volumePaths = (): string[] => paths().filter((path) => path.startsWith("/volumes/"))

beforeAll(async () => {
  payload = await getPayload()
  author = await createUser("writer")
})

afterEach(() => {
  vi.clearAllMocks()
})

async function touch(id: number): Promise<void> {
  await payload.update({
    collection: "articles",
    id,
    overrideAccess: true,
    data: { title: `Touched ${Date.now()}` },
  })
}

describe("revalidateArticle (afterChange)", () => {
  it("refreshes the article and only the volumes that list it", async () => {
    const article = await createArticle({ authors: [author.id] })
    const other = await createArticle({ authors: [author.id] })
    const listing = await createVolume({ articles: [article.id] })
    const unrelated = await createVolume({ articles: [other.id] })

    await touch(article.id)

    expect(paths()).toContain(`/articles/${article.slug}`)
    expect(volumePaths()).toEqual([`/volumes/${listing.slug}`])
    expect(volumePaths()).not.toContain(`/volumes/${unrelated.slug}`)
  })

  it("refreshes no volume for an article no volume lists", async () => {
    const article = await createArticle({ authors: [author.id] })
    await createVolume()

    await touch(article.id)

    expect(paths()).toContain(`/articles/${article.slug}`)
    expect(volumePaths()).toEqual([])
  })

  it("leaves a draft that was never published alone", async () => {
    const draft = await createArticle({ authors: [author.id], _status: "draft" })

    await payload.update({
      collection: "articles",
      id: draft.id,
      overrideAccess: true,
      draft: true,
      data: { title: "Still a draft" },
    })

    expect(paths()).toEqual([])
  })

  it("skips everything when the caller turns revalidation off", async () => {
    const article = await createArticle({ authors: [author.id] })

    await payload.update({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { title: "Quiet edit" },
    })

    expect(paths()).toEqual([])
  })
})

describe("revalidateDelete (afterDelete)", () => {
  it("refreshes the deleted article's paths and the volumes that listed it", async () => {
    const article = await createArticle({ authors: [author.id] })
    const listing = await createVolume({ articles: [article.id] })

    await payload.delete({ collection: "articles", id: article.id, overrideAccess: true })

    expect(paths()).toContain(`/articles/${article.slug}`)
    expect(volumePaths()).toEqual([`/volumes/${listing.slug}`])
  })
})
