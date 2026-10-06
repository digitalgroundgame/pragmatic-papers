import type { Payload } from "payload"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"
import { createArticle, createVolume } from "../helpers/content"
import { createUser, getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { revalidatePath } = await import("next/cache")

/**
 * `revalidateUser` refreshes an author's page, the authors index, every published article they
 * wrote and every volume listing one of those, found by querying the real database.
 */
let payload: Payload

const paths = (): string[] => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)

beforeAll(async () => {
  payload = await getPayload()
})

afterEach(() => {
  vi.clearAllMocks()
})

function rename(user: User, name: string): Promise<User> {
  return payload.update({ collection: "users", id: user.id, overrideAccess: true, data: { name } })
}

describe("revalidateUser", () => {
  it("refreshes the author's published articles and the volumes that list them", async () => {
    const author = await createUser("writer")
    const colleague = await createUser("writer")
    const theirs = await createArticle({ authors: [author.id] })
    const shared = await createArticle({ authors: [colleague.id, author.id] })
    const draft = await createArticle({ authors: [author.id], _status: "draft" })
    const notTheirs = await createArticle({ authors: [colleague.id] })
    const listing = await createVolume({ articles: [shared.id] })
    const unrelated = await createVolume({ articles: [notTheirs.id] })

    const renamed = await rename(author, author.name!)

    expect(paths()).toEqual(
      expect.arrayContaining([
        `/authors/${renamed.slug}`,
        "/authors",
        `/articles/${theirs.slug}`,
        `/articles/${shared.slug}`,
        `/volumes/${listing.slug}`,
      ]),
    )
    expect(paths()).not.toContain(`/articles/${draft.slug}`)
    expect(paths()).not.toContain(`/articles/${notTheirs.slug}`)
    expect(paths()).not.toContain(`/volumes/${unrelated.slug}`)
  })

  it("refreshes the old author page too when the slug changes", async () => {
    const author = await createUser("writer")

    const renamed = await payload.update({
      collection: "users",
      id: author.id,
      overrideAccess: true,
      data: { slug: `renamed-${author.id}` },
    })

    expect(renamed.slug).toBe(`renamed-${author.id}`)
    expect(paths()).toEqual(
      expect.arrayContaining([`/authors/${renamed.slug}`, `/authors/${author.slug}`, "/authors"]),
    )
  })

  it("refreshes only the author pages for someone with no articles", async () => {
    const author = await createUser("writer")

    const renamed = await rename(author, author.name!)

    expect(paths()).toEqual([`/authors/${renamed.slug}`, "/authors"])
  })

  it("refreshes no volume when the author's articles aren't in one", async () => {
    const author = await createUser("writer")
    const article = await createArticle({ authors: [author.id] })

    await rename(author, author.name!)

    expect(paths()).toContain(`/articles/${article.slug}`)
    expect(paths().filter((path) => path.startsWith("/volumes/"))).toEqual([])
  })

  it("skips everything when the caller turns revalidation off", async () => {
    const author = await createUser("writer")

    await payload.update({
      collection: "users",
      id: author.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { name: "Quiet rename" },
    })

    expect(paths()).toEqual([])
  })
})
