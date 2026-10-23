import { Forbidden, type CollectionBeforeOperationHook } from "payload"
import { isEditor } from "@/access/roles"

/**
 * Only editors take a live article down. A writer may save drafts of an article they
 * created or are credited on, which `isDraftOrEditor` allows, but an update that sets
 * `_status: "draft"` without saving a draft is an unpublish, and access can't tell the
 * two apart: both arrive as a draft status, and only the operation knows `draft`.
 */
export const keepWritersFromUnpublishing: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (operation !== "update" || args.overrideAccess || args.draft) return args
  if (!req.user || isEditor(req.user)) return args
  const { data, id } = args as { data?: { _status?: unknown }; id?: number | string }
  if (data?._status !== "draft") return args

  // A bulk update can't be checked one article at a time here, so a writer gets none.
  if (id === undefined) throw new Forbidden(req.t)

  const current = await req.payload.findByID({
    collection: "articles",
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
    select: { _status: true },
  })
  if (current?._status === "published") throw new Forbidden(req.t)

  return args
}
