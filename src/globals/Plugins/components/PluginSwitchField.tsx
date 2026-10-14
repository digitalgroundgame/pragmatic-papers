"use client"

import { useField } from "@payloadcms/ui"

import { PluginSwitch } from "./PluginSwitch"

/** A switchable plugin's switch, bound to its checkbox in the Plugins global's form. */
export function PluginSwitchField({ name, path }: { name: string; path: string }): React.ReactNode {
  const { value, setValue, disabled } = useField<boolean>({ path })
  return (
    <PluginSwitch
      name={name}
      checked={Boolean(value)}
      disabled={disabled}
      onCheckedChange={setValue}
    />
  )
}
