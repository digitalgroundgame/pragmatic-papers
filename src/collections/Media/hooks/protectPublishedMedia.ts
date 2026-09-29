import { APIError, type CollectionBeforeDeleteHook } from "payload"
import { mediaReferencesInRequest } from "../references/collectMediaReferences"
import { describeRefusal } from "../references/labels"

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
    payload.logger.warn(
      { refs, mediaId: id },
      `Media deletion blocked — in use in published content`,
    )

    throw new APIError(describeRefusal(refs), 400, null, true)
  }
}
