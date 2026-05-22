import { APIError, type CollectionBeforeDeleteHook } from "payload"
import { collectMediaReferences } from "@/utilities/collectMediaReferences"

export const protectPublishedMedia: CollectionBeforeDeleteHook = async ({
  id,
  req: { payload },
}) => {
  const refs = await collectMediaReferences(payload, id)

  if (refs.length > 0) {
    const docList = refs.map((r) => `"${r.docTitle}" (${r.collection}/${r.field})`).join(", ")

    const summary =
      refs.length === 1
        ? `Cannot delete: used in ${docList}`
        : `Cannot delete: used in ${refs.length} published documents`

    payload.logger.warn(
      { refs, mediaId: id },
      `Media deletion blocked \u2014 in use in published content`,
    )

    throw new APIError(summary, 400, null, true)
  }
}
