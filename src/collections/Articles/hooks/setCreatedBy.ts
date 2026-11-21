import type { CollectionBeforeChangeHook } from "payload"
import type { Article } from "@/payload-types"

/**
 * BeforeChange hook that records who created the article. Only a create by a signed-in
 * user sets it; `createdBy` can't be updated afterwards (its field access refuses).
 */
export const setCreatedBy = (
  args: Parameters<CollectionBeforeChangeHook<Article>>[0],
): Partial<Article> | void => {
  const { req, operation, data } = args
  if (operation === "create") {
    if (req.user) {
      data.createdBy = req.user.id
      return data
    }
  }
}
