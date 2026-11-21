import type { Condition, Field, FieldHook, Payload } from "payload"

import { hasRole, isEditor } from "@/access/roles"
import type { Article, User } from "@/payload-types"
import { relationshipId } from "@/utilities/relationships"

type ArticleCredits = Pick<Article, "authors" | "narration">

const creditedAuthor = (user: User, article: Partial<ArticleCredits>): boolean =>
  (article.authors ?? []).some((author) => relationshipId(author) === user.id)

/**
 * Whether a user may see an article's stats: editors and admins on every article, writers on
 * the articles they're credited on, and narrators on the articles they narrated (the
 * narration audio's `narrator`).
 */
export async function canSeeArticleStats(
  payload: Payload,
  user: User | null | undefined,
  article: ArticleCredits,
): Promise<boolean> {
  if (!user) return false
  if (isEditor(user)) return true
  if (hasRole(user, "writer") && creditedAuthor(user, article)) return true
  if (!hasRole(user, "narrator")) return false

  const narrationId = relationshipId(article.narration)
  if (narrationId === null) return false
  const narration = await payload.findByID({
    collection: "media",
    id: narrationId,
    depth: 0,
    overrideAccess: true,
    select: { narrator: true },
    disableErrors: true,
  })
  return relationshipId(narration?.narrator) === user.id
}

/** Names the virtual field that says whether the signed-in user may see this article's stats. */
export const STATS_FLAG = "canSeeStats"

const flagStats: FieldHook<Article, boolean | undefined> = async ({ data, findMany, req }) => {
  if (findMany || !req.user || !data) return undefined
  return canSeeArticleStats(req.payload, req.user as User, data as ArticleCredits)
}

/**
 * True on an article the signed-in user may see the stats of. A tab's condition can't query
 * (a narrator's access depends on the narration audio's record), so this works it out when
 * the article is loaded for its edit view, and the tab's condition reads it. Lists skip it.
 * It's virtual: no column.
 */
export const statsFlagField: Field = {
  name: STATS_FLAG,
  type: "checkbox",
  virtual: true,
  access: { create: () => false, update: () => false },
  admin: { hidden: true },
  hooks: {
    afterRead: [flagStats],
  },
}

/** The Stats tab shows to whoever may see the article's stats, once it's been saved. */
export const showStatsTab: Condition = (data) => data?.id != null && data[STATS_FLAG] === true
