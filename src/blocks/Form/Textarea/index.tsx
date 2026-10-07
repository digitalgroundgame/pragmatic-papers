import type { TextField } from "@payloadcms/plugin-form-builder/types"
import type { FieldValues, UseFormRegister } from "react-hook-form"

import { Label } from "@/components/ui/label"
import { Textarea as TextAreaComponent } from "@/components/ui/textarea"
import React from "react"

import { Error, useErrorProps } from "../Error"
import { Width } from "../Width"

export const Textarea: React.FC<
  TextField & {
    register: UseFormRegister<FieldValues>
    rows?: number
  }
> = ({ name, defaultValue, label, register, required, rows = 3, width }) => {
  const errorProps = useErrorProps(name)
  return (
    <Width width={width}>
      <Label htmlFor={name}>
        {label}

        {required && (
          <span className="required">
            * <span className="sr-only">(required)</span>
          </span>
        )}
      </Label>

      <TextAreaComponent
        defaultValue={defaultValue}
        id={name}
        rows={rows}
        {...errorProps}
        {...register(name, { required: required })}
      />

      <Error name={name} />
    </Width>
  )
}
