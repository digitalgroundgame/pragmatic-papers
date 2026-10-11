import type { TextField } from "@payloadcms/plugin-form-builder/types"
import type { FieldValues, UseFormRegister } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import React from "react"

import { Error, useErrorProps } from "../Error"
import { Width } from "../Width"

export const Text: React.FC<
  TextField & {
    register: UseFormRegister<FieldValues>
  }
> = ({ name, defaultValue, label, register, required, width }) => {
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
      <Input
        defaultValue={defaultValue}
        id={name}
        type="text"
        {...register(name, { required })}
        {...errorProps}
      />
      <Error name={name} />
    </Width>
  )
}
