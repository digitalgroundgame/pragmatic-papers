"use client"

import { useFormFields } from "@payloadcms/ui"

/**
 * Whether the document being edited is an audio upload.
 *
 * `mimeType` is only populated once an upload has been persisted, so it is blank
 * while a newly selected file is still pending. The admin form holds that pending
 * file at form path "file", which carries the type before the server has seen it.
 * Files are stripped from form state requests, so this must be evaluated on the
 * client — an `admin.condition` cannot see the pending file.
 */
export const useIsAudioUpload = (): boolean =>
  useFormFields(([fields]) => {
    const pendingType = (fields?.file?.value as { type?: string } | undefined)?.type
    const savedType = fields?.mimeType?.value as string | undefined
    return Boolean((pendingType ?? savedType)?.startsWith("audio/"))
  })
