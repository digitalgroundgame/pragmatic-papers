"use client"

import { useField, useFormFields } from "@payloadcms/ui"
import type { TextFieldClientComponent } from "payload"
import { useEffect, useRef } from "react"

import { isPickedFile } from "./pickedFiles"

/**
 * Renders nothing. Keeps `unsplashId` true to the file: the picker sets it, and it's cleared
 * when that file is removed or replaced with another, so the save doesn't credit a
 * photographer for someone else's picture.
 */
export const UnsplashIdField: TextFieldClientComponent = ({ path }) => {
  const { value, setValue } = useField<string | null>({ path })
  const file = useFormFields(([fields]) => fields.file?.value)
  // Whether the picked file has reached the form yet: the id is set a moment before it does.
  const arrived = useRef(false)

  useEffect(() => {
    if (!value) {
      arrived.current = false
      return
    }
    if (file instanceof File) {
      if (isPickedFile(value, file)) arrived.current = true
      else setValue(null)
    } else if (!file && arrived.current) {
      arrived.current = false
      setValue(null)
    }
  }, [file, value, setValue])

  return null
}
