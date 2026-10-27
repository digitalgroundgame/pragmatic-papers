"use client"

import { FieldLabel, useField } from "@payloadcms/ui"
import type { TextareaFieldClientComponent } from "payload"
import React from "react"

import { DocDiff } from "./DocDiff"

/** A suggestion's `changes`, shown as a diff rather than the raw text. */
export const SuggestionChanges: TextareaFieldClientComponent = ({ field, path }) => {
  const { value } = useField<string>({ path: path ?? field.name })
  return (
    <div className="field-type">
      <FieldLabel label={field.label ?? "Changes"} path={path} />
      <DocDiff diff={value ?? ""} />
    </div>
  )
}
