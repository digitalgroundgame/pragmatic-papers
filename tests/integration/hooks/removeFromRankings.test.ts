import type { Payload } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"
import { createArticle } from "../helpers/content"
import { createUser, getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/**
 * `removeFromRankings` (`src/collections/Articles/hooks/removeFromRankings.ts`) against a real
 * database: without it, Postgres rejects deleting a ranked article, because the ranking's
 * NOT NULL `article_id` can't take the foreign key's ON DELETE SET NULL.
 */
let payload: Payload
let author: User

beforeAll(async () => {
  payload = await getPayload()
  author = await createUser("writer")
})

async function rank(articleIds: number[]): Promise<void> {
  await payload.updateGlobal({
    slug: "article-recommendations",
    context: { disableRevalidate: true },
    data: {
      rankings: articleIds.map((article, i) => ({ article, engagementScore: 100 - i })),
    },
  })
}

async function rankedIds(): Promise<number[]> {
  const recommendations = await payload.findGlobal({ slug: "article-recommendations", depth: 0 })
  return (recommendations.rankings ?? []).map((ranking) =>
    typeof ranking.article === "object" ? ranking.article.id : ranking.article,
  )
}

describe("removeFromRankings (beforeDelete)", () => {
  it("deletes a ranked article and drops it from the rankings, keeping the rest in order", async () => {
    const first = await createArticle({ authors: [author.id] })
    const ranked = await createArticle({ authors: [author.id] })
    const last = await createArticle({ authors: [author.id] })
    await rank([first.id, ranked.id, last.id])

    await payload.delete({
      collection: "articles",
      id: ranked.id,
      context: { disableRevalidate: true },
    })

    const remaining = await payload.find({
      collection: "articles",
      where: { id: { equals: ranked.id } },
      depth: 0,
    })
    expect(remaining.totalDocs).toBe(0)
    expect(await rankedIds()).toEqual([first.id, last.id])
  })

  it("deletes every ranked article in a bulk delete", async () => {
    const a = await createArticle({ authors: [author.id] })
    const b = await createArticle({ authors: [author.id] })
    await rank([a.id, b.id])

    const result = await payload.delete({
      collection: "articles",
      where: { id: { in: [a.id, b.id] } },
      context: { disableRevalidate: true },
    })

    expect(result.errors).toEqual([])
    expect(await rankedIds()).toEqual([])
  })

  it("leaves the rankings alone when the deleted article isn't ranked", async () => {
    const ranked = await createArticle({ authors: [author.id] })
    const unranked = await createArticle({ authors: [author.id] })
    await rank([ranked.id])
    const before = await payload.findGlobal({ slug: "article-recommendations", depth: 0 })

    await payload.delete({
      collection: "articles",
      id: unranked.id,
      context: { disableRevalidate: true },
    })

    const after = await payload.findGlobal({ slug: "article-recommendations", depth: 0 })
    expect(after.rankings).toEqual(before.rankings)
    expect(after.updatedAt).toBe(before.updatedAt)
  })
})
