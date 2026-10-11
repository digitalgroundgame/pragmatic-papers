import type { CountryField } from "@payloadcms/plugin-form-builder/types"
import type { Control } from "react-hook-form"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import React from "react"
import { Controller } from "react-hook-form"

import { Error, useErrorProps } from "../Error"
import { Width } from "../Width"
import { countryOptions } from "./options"

export const Country: React.FC<
  CountryField & {
    control: Control
  }
> = ({ name, control, label, required, width }) => {
  const errorProps = useErrorProps(name)
  return (
    <Width width={width}>
      <Label className="" htmlFor={name}>
        {label}

        {required && (
          <span className="required">
            * <span className="sr-only">(required)</span>
          </span>
        )}
      </Label>
      <Controller
        control={control}
        defaultValue=""
        name={name}
        render={({ field: { onChange, value } }) => {
          return (
            <Select items={countryOptions} onValueChange={(val) => onChange(val)} value={value}>
              <SelectTrigger className="w-full" id={name} {...errorProps}>
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent aria-label={label || name}>
                {/* eslint-disable-next-line @typescript-eslint/no-shadow */}
                {countryOptions.map(({ label, value }) => {
                  return (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )
        }}
        rules={{ required }}
      />
      <Error name={name} />
    </Width>
  )
}
