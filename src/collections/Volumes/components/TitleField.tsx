"use client"

import React from "react"
import type { TextareaFieldClientProps } from "payload"
import { TextareaField, useFormFields } from "@payloadcms/ui"

type TitleFieldProps = {
  checkboxFieldPath: string
} & TextareaFieldClientProps

export const TitleFieldComponent: React.FC<TitleFieldProps> = (props) => {
  const { checkboxFieldPath } = props

  // The value of the autoGenerateTitle checkbox
  const autoGenerateTitle = useFormFields(([fields]) => {
    return fields[checkboxFieldPath]?.value as boolean
  })

  const readOnly = props.readOnly || autoGenerateTitle

  return (
    <div
      title={
        autoGenerateTitle
          ? "Title is automatically generated from articles (disable auto-generate to edit manually)"
          : undefined
      }
    >
      <TextareaField
        {...props}
        readOnly={Boolean(readOnly)}
        field={{
          ...props.field,
          admin: {
            ...props.field.admin,
          },
        }}
      />
    </div>
  )
}
