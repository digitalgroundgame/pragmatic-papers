import type { TextFieldSingleValidation } from "payload"

import type { Media } from "@/payload-types"

/**
 * An image needs alt text: it's what screen readers say in its place, and what shows when it
 * doesn't load. Audio and video are described by their captions instead.
 *
 * Only an editor's save is checked. Seeding, cloning from production and other scripts run
 * through the Local API without a user and copy whatever they were given. Images uploaded
 * before this check may have none; they can still be edited without adding it, but alt text
 * once written can't be cleared.
 */
export const validateAlt: TextFieldSingleValidation = (value, { data, id, previousValue, req }) => {
  const { mimeType } = data as Partial<Media>
  if (!req.user || !mimeType?.startsWith("image/") || value?.trim()) return true
  if (id != null && !previousValue?.trim()) return true
  return "Describe the image for readers who can't see it."
}
