import type { Media } from "@/payload-types"
import { type CollectionBeforeChangeHook } from "payload"

import { blurDataUrl } from "@/collections/Media/blurDataUrl"

export const generateBlurDataUrl: CollectionBeforeChangeHook<Media> = async ({ data, req }) => {
  const { file } = req

  // Only run when a file is actually being uploaded
  if (!file || !file.mimetype?.startsWith("image/")) {
    return data
  }

  // A browser upload to S3 (the storage plugin's `clientUploads`) reaches the server as an
  // empty buffer: Payload downloads the object to a temp file and names it in `tempFilePath`.
  const input = file.data.length > 0 ? file.data : file.tempFilePath
  if (!input) {
    req.payload.logger.info(`No image bytes to blur for: ${file.name}`)
    return data
  }

  try {
    req.payload.logger.info(`Generating blur data URL for: ${file.name}`)
    data.blurDataURL = await blurDataUrl(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    req.payload.logger.error(`Failed to generate blur data URL: ${message}`)
  }

  return data
}
