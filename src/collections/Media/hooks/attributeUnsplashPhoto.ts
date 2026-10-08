import { APIError, type CollectionBeforeChangeHook } from "payload"

import { unsplash } from "@/integrations"
import type { UnsplashPhoto } from "@/integrations/unsplash"
import type { Media } from "@/payload-types"

type Caption = NonNullable<Media["caption"]>
type Node = Caption["root"]["children"][number]

const text = (value: string): Node => ({
  detail: 0,
  format: 0,
  mode: "normal",
  style: "",
  text: value,
  type: "text",
  version: 1,
})

const link = (label: string, url: string): Node => ({
  children: [text(label)],
  direction: "ltr",
  fields: { linkType: "custom", newTab: true, url },
  format: "",
  indent: 0,
  type: "link",
  version: 1,
})

/** "Photo by <name> on Unsplash.", both linked, the credit Unsplash's guidelines ask for. */
export function unsplashCredit(photo: UnsplashPhoto, homeUrl: string): Node {
  return {
    children: [
      text("Photo by "),
      link(photo.photographer.name, photo.photographer.profileUrl),
      text(" on "),
      link("Unsplash", homeUrl),
      text("."),
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
    textStyle: "",
  }
}

/** The caption with the credit as its last paragraph: the whole caption when there was none. */
export function withCredit(caption: Media["caption"], credit: Node): Caption {
  const existing = caption?.root?.children ?? []
  const hasText = JSON.stringify(existing).includes('"text":"')
  return {
    root: {
      type: "root",
      direction: "ltr",
      format: "",
      indent: 0,
      version: 1,
      ...caption?.root,
      children: hasText ? [...existing, credit] : [credit],
    },
  }
}

/**
 * Media picked from Unsplash (the upload controls' "Search Unsplash") carries the photo's id.
 * When that id is new on this document, credit the photographer in the caption, fall back to
 * Unsplash's description for the alt text, and count the download, as Unsplash's API
 * guidelines require of an app that saves their photos. The photo is looked up again here
 * rather than trusted from the form, so the credit always names the real photographer.
 *
 * When Unsplash can't be reached the save fails and says so, rather than keeping a photo
 * nobody is credited for; saving again retries.
 */
export const attributeUnsplashPhoto: CollectionBeforeChangeHook<Media> = async ({
  data,
  originalDoc,
  req,
}) => {
  const photoId = data.unsplashId
  if (!photoId || photoId === originalDoc?.unsplashId) return data

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
