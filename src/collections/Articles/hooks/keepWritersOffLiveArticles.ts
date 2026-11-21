import { Forbidden, type CollectionBeforeOperationHook, type PayloadRequest } from "payload"
import { isEditor } from "@/access/roles"
import type { Article } from "@/payload-types"
import { relationshipId } from "@/utilities/relationships"

async function isLive(req: PayloadRequest, id: number | string | null): Promise<boolean> {
  if (id === null) return false
  const current = await req.payload.findByID({
    collection: "articles",
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
    select: { _status: true },
  })
  return current?._status === "published"
}

/**
 * Only editors change what readers see of a live article. A writer may save drafts of an
 * article they created or are credited on, which `isDraftOrEditor` allows, but any update
 * that isn't a draft save writes the live article: with `_status: "draft"` it unpublishes
 * it, and with no `_status` it changes it in place. Access can't tell either from a draft
 * save, because only the operation knows `draft`. Restoring an older draft version over
 * the live article unpublishes it too. Deleting a live article is refused to writers by
 * `canDeleteArticle`. A copy takes its source's `_status`, which `canCreateArticle` can't
 * see (it's handed the request's data, not the source), so a writer's copy is saved as a draft.
 */
export const keepWritersOffLiveArticles: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  const { draft, duplicateFromID, id, overrideAccess } = args as {
    draft?: boolean
    duplicateFromID?: number | string | null
    id?: number | string
    overrideAccess?: boolean
  }
  if (overrideAccess || draft) return args
  if (!req.user || isEditor(req.user)) return args

  if (operation === "restoreVersion" && id !== undefined) {
    // Restoring a draft version, unless restored as a draft, writes it over the live article.
    const version = await req.payload.findVersionByID({
      collection: "articles",
      id: String(id),
      depth: 0,
      disableErrors: true,
      overrideAccess: true,
      req,
    })
    if (!version || version.version._status === "published") return args
    if (await isLive(req, relationshipId(version.parent as Article | number)))
      throw new Forbidden(req.t)
    return args
  }

  if (operation === "create" && duplicateFromID !== undefined && duplicateFromID !== null) {
    return { ...args, draft: true }
  }

  if (operation !== "update") return args

  // A bulk update can't be checked one article at a time here, so a writer gets none.
  if (id === undefined) throw new Forbidden(req.t)

  if (await isLive(req, id)) throw new Forbidden(req.t)
  return args
}
