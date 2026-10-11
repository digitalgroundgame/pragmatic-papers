"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { FieldError } from "@/components/ui/field"

const errorId = (name: string): string => `${name}-error`

/**
 * The props that tie a field's control to its `<Error>`: `aria-invalid` once
 * validation fails, and `aria-describedby` pointing at the message.
 */
export const useErrorProps = (
  name: string,
): { "aria-describedby"?: string; "aria-invalid"?: true } => {
  const {
    formState: { errors },
  } = useFormContext()
  if (!errors[name]) return {}
  return { "aria-describedby": errorId(name), "aria-invalid": true }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const Error = ({ name }: { name: string }) => {
  const {
    formState: { errors },
  } = useFormContext()
  if (!errors[name]) return null

  return (
    <FieldError className="mt-2" id={errorId(name)}>
      {(errors[name]?.message as string) || "This field is required"}
    </FieldError>
  )
}
