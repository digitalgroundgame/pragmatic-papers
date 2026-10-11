"use client"

import { useField, useForm, useFormFields } from "@payloadcms/ui"
import type { TextFieldClientComponent } from "payload"
import { useEffect, useRef } from "react"

import type { Media } from "@/payload-types"

import { hasCredit, withCredit } from "../../unsplashCredit"
import { isPickedFile } from "./pickedFiles"

/**
 * Renders nothing. Keeps `unsplashId` true to the file: the picker sets it, and it's cleared
 * when that file is removed or replaced with another, along with the credit the picker put in
 * the caption, so nobody is credited for someone else's picture.
 */
export const UnsplashIdField: TextFieldClientComponent = ({ path }) => {
  const { value, setValue } = useField<string | null>({ path })
  const file = useFormFields(([fields]) => fields.file?.value)
  const caption = useFormFields(([fields]) => fields.caption?.value) as Media["caption"]
  const { dispatchFields } = useForm()
  // Whether the picked file has reached the form yet: the id is set a moment before it does.
  const arrived = useRef(false)

  useEffect(() => {
    const forget = (): void => {
      setValue(null)
      if (!hasCredit(caption)) return
      // The caption editor only redraws when its initial value changes.
      const uncredited = withCredit(caption, null)
      dispatchFields({
        type: "UPDATE",
        path: "caption",
        value: uncredited,
        initialValue: uncredited,
      })
    }
    if (!value) {
      arrived.current = false
      return
    }
    if (file instanceof File) {
      if (isPickedFile(value, file)) arrived.current = true
      else forget()
    } else if (!file && arrived.current) {
      arrived.current = false
      forget()
    }
  }, [caption, dispatchFields, file, value, setValue])

  return null
}
