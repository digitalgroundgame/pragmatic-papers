"use client"

import { Switch } from "@/components/ui/switch"

import "@/globals/SiteSettings/components/ExperimentSwitch.css"

/**
 * A plugin's on/off switch in the Status column of System → Plugins. Presentational:
 * `PluginSwitchField` connects a switchable plugin's to the form, and a plugin without one shows
 * it disabled.
 */
export function PluginSwitch({
  name,
  checked,
  disabled,
  title,
  onCheckedChange,
}: {
  /** The plugin's name, which labels the switch. */
  name: string
  checked: boolean
  disabled?: boolean
  title?: string
  onCheckedChange?: (checked: boolean) => void
}): React.ReactNode {
  return (
    <span className="plugin-switch" title={title}>
      <Switch
        aria-label={name}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange?.(next)}
      />
    </span>
  )
}
