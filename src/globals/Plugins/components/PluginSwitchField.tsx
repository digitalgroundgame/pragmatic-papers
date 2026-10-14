"use client"

import { useField } from "@payloadcms/ui"

import type { PluginRow } from "./load"
import { PluginSwitch } from "./PluginSwitch"

/** Why a plugin whose switch was saved on isn't running, by what reading it said. */
const NOT_RUNNING = {
  off: "Not running: something it needs is off.",
  unknown: "Couldn't read whether it's running.",
} as const

/**
 * A switchable plugin's switch, bound to its checkbox in the Plugins global's form. `status` is
 * whether it was running when the page loaded: a plugin can need more than its own switch
 * (comments need Single sign-on), so a switch saved on gets a note when it wasn't.
 */
export function PluginSwitchField({
  name,
  path,
  status,
}: {
  name: string
  path: string
  status: PluginRow["status"]
}): React.ReactNode {
  const { value, initialValue, setValue, disabled } = useField<boolean>({ path })
  const note = initialValue === true && status !== "on" ? NOT_RUNNING[status] : null
  return (
    <span style={{ alignItems: "center", display: "inline-flex", gap: "0.5rem" }}>
      <PluginSwitch
        name={name}
        checked={Boolean(value)}
        disabled={disabled}
        onCheckedChange={setValue}
      />
      {note && <span style={{ color: "var(--theme-elevation-650)" }}>{note}</span>}
    </span>
  )
}
