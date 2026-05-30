"use client"

import { TextareaField, useFormFields } from "@payloadcms/ui"
import type { TextareaFieldClientProps } from "payload"
import React from "react"

export const NoteField: React.FC<TextareaFieldClientProps> = (props) => {
  const parts = props.path.split(".")
  parts[parts.length - 1] = "sourceId"
  const sourceIdPath = parts.join(".")

  const sourceId = useFormFields(([fields]) => fields[sourceIdPath]?.value as string | undefined)

  if (sourceId) return null

  return <TextareaField {...props} />
}
