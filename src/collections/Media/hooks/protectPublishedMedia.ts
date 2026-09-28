import { APIError, type CollectionBeforeDeleteHook } from "payload"
import { mediaReferencesInRequest } from "../references/collectMediaReferences"

/**
 * Set on a delete's `context` to delete media even while published content uses it.
 * Only for clearing everything at once, as the seed does, where the content that uses
 * the media is about to go too.
 */
export const DELETE_MEDIA_IN_USE = "deleteMediaInUse"

export const protectPublishedMedia: CollectionBeforeDeleteHook = async ({ context, id, req }) => {
  if (context[DELETE_MEDIA_IN_USE]) return

  const { payload } = req
  const refs = await mediaReferencesInRequest(req, id)

  if (refs.length > 0) {
    const docList = refs.map((r) => `"${r.docTitle}" (${r.collection}/${r.field})`).join(", ")

    const summary =
      refs.length === 1
        ? `Cannot delete: used in ${docList}`
        : `Cannot delete: used in ${refs.length} published documents`

    payload.logger.warn(
      { refs, mediaId: id },
      `Media deletion blocked — in use in published content`,
    )

    throw new APIError(summary, 400, null, true)
  }
}
