import type { CollectionBeforeDeleteHook, PayloadRequest } from "payload"
import { relationshipId } from "@/utilities/relationships"

/**
 * A bulk delete runs this hook for every article at once, in one transaction. Each run
 * reads the rankings and writes them back, so runs sharing a request wait their turn:
 * two at once would each write back the other's article.
 */
const pending = new WeakMap<PayloadRequest, Promise<void>>()

async function removeArticle(id: number | string, req: PayloadRequest): Promise<void> {
  const recommendations = await req.payload.findGlobal({
    slug: "article-recommendations",
    depth: 0,
    req,
  })
  const rankings = recommendations.rankings ?? []
  const kept = rankings.filter((ranking) => {
    const articleId = relationshipId(ranking.article)
    return String(articleId) !== String(id)
  })
  if (kept.length === rankings.length) return

  await req.payload.updateGlobal({
    slug: "article-recommendations",
    data: { rankings: kept },
    depth: 0,
    req,
  })
}

/**
 * Takes a deleted article out of the article-recommendations rankings. A ranking's
 * `article` column is NOT NULL but its foreign key is ON DELETE SET NULL, so Postgres
 * would reject the delete while the article is still ranked. Runs in the delete's
 * transaction (`req`), so a delete that fails later leaves the rankings as they were.
 */
export const removeFromRankings: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const run = (pending.get(req) ?? Promise.resolve()).then(() => removeArticle(id, req))
  pending.set(
    req,
    run.catch(() => undefined),
  )
  await run
}
