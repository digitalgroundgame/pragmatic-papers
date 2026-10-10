"use client"

import { useField, useTranslation } from "@payloadcms/ui"
import type { CheckboxFieldClientComponent } from "payload"

import { ExperimentSwitch } from "./ExperimentSwitch"

type Static = string | Record<string, string> | false | undefined

/** A static label or description in the admin's language. */
function translate(text: Static, language: string): string | undefined {
  if (!text) return undefined
  if (typeof text === "string") return text
  return text[language] ?? Object.values(text)[0]
}

/** Settings' experiment checkboxes, shown as on/off switches. The value stays a boolean. */
export const ExperimentSwitchField: CheckboxFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue, disabled } = useField<boolean>({ path })
  const { i18n } = useTranslation()
  const description = field.admin?.description
  return (
    <ExperimentSwitch
      id={`field-${path.replace(/\./g, "__")}`}
      label={translate(field.label, i18n.language) ?? field.name}
      description={
        typeof description === "function" ? undefined : translate(description, i18n.language)
      }
      checked={Boolean(value)}
      disabled={readOnly || disabled}
      onCheckedChange={setValue}
    />
  )
}
