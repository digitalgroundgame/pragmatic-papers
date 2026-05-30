import type { Media } from "@/payload-types"
import { type CollectionBeforeChangeHook } from "payload"

import { getBlurDataUrlFromBuffer } from "@/utilities/getBlurDataUrlFromBuffer"

export const generateBlurDataUrl: CollectionBeforeChangeHook<Media> = async ({ data, req }) => {
  const { file } = req

  // Only run when a file is actually being uploaded
  if (!file || !file.mimetype?.startsWith("image/")) {
    return data
  }

  try {
    req.payload.logger.info(`Generating blur data URL for: ${file.name}`)
    data.blurDataURL = await getBlurDataUrlFromBuffer(file.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    req.payload.logger.error(`Failed to generate blur data URL: ${message}`)
  }

  return data
}
