import { APIError, type CollectionBeforeValidateHook } from "payload"

import { unsplash } from "@/integrations"
import type { UnsplashPhoto } from "@/integrations/unsplash"
import type { Media } from "@/payload-types"

import { unsplashCredit, withCredit } from "../unsplashCredit"

/**
 * Media picked from Unsplash (the upload controls' "Search Unsplash") carries the photo's id.
 * When that id is new on this document, credit the photographer in the caption, fall back to
 * Unsplash's description for the alt text, and count the download, as Unsplash's API
 * guidelines require of an app that saves their photos. The photo is looked up again here
 * rather than trusted from the form, so the credit always names the real photographer; it
 * replaces the credit the picker put in the caption, so there's only ever one.
 *
 * It runs before validation, so the alt text it fills in counts toward the alt text an image
 * needs (`validateAlt`).
 *
 * When Unsplash can't be reached the save fails and says so, rather than keeping a photo
 * nobody is credited for; saving again retries.
 */
export const attributeUnsplashPhoto: CollectionBeforeValidateHook<Media> = async ({
  data,
  originalDoc,
  req,
}) => {
  const photoId = data?.unsplashId
  if (!data || !photoId || photoId === originalDoc?.unsplashId) return data

  let photo: UnsplashPhoto
  try {
    photo = await unsplash.photo(photoId)
  } catch (err) {
    req.payload.logger.error({ err }, `Couldn't look up Unsplash photo ${photoId} to credit it`)
    throw new APIError(
      "Couldn't reach Unsplash to credit this photo's photographer. Try saving again.",
      502,
      undefined,
      true,
    )
  }

  data.caption = withCredit(data.caption, unsplashCredit(photo, unsplash.homeUrl()))
  if (!data.alt?.trim() && photo.alt) data.alt = photo.alt
  // Not awaited: counting the download is Unsplash's business and shouldn't slow the save.
  unsplash.trackDownload(photo).catch((err: unknown) => {
    req.payload.logger.warn({ err }, `Counting the Unsplash download of ${photoId} failed`)
  })
  return data
}
