"use client"

import React from "react"
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TextFieldClientProps } from "payload"

import { FieldLabel, TextInput, useField } from "@payloadcms/ui"

import "./index.scss"

type ColorPickerComponentProps = TextFieldClientProps

export const ColorPickerComponent: React.FC<ColorPickerComponentProps> = ({
  field,
  path,
  readOnly: readOnlyFromProps,
}) => {
  const { value, setValue } = useField<string>({ path: path || field.name })

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.toUpperCase()
    setValue(input)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value

    // Remove all characters except #, 0-9, A-F, a-f
    input = input.replace(/[^#0-9A-Fa-f]/g, "")

    // Ensure # is at the start, and remove any additional # characters
    if (input.startsWith("#")) {
      input = "#" + input.slice(1).replace(/#/g, "")
    } else if (input.length > 0) {
      // If there's input but no #, add it at the start
      input = "#" + input
    }

    // Limit length: max 7 characters for #RRGGBB format
    if (input.length > 7) {
      input = input.slice(0, 7)
    }

    // Convert to uppercase for consistency
    input = input.toUpperCase()

    setValue(input)
  }
  const readOnly = Boolean(readOnlyFromProps)

  return (
    <div className="field-type color-picker-field-component">
      <FieldLabel htmlFor={`field-${path}`} label={field.label} />
      <div className="color-picker-wrapper">
        <input
          id={`#${field.label}`}
          type="color"
          value={value || "#000000"}
          onChange={handleColorChange}
          disabled={readOnly}
          className="color-picker-input"
          aria-label="Color picker"
        />
        <TextInput
          value={value || ""}
          onChange={handleTextChange}
          path={path || field.name}
          readOnly={readOnly}
          placeholder="#FF5733"
          className="color-picker-text-input"
        />
      </div>
    </div>
  )
}
