"use client"

import { Switch } from "@/components/ui/switch"

import "./ExperimentSwitch.css"

/**
 * One experiment's on/off switch in the Settings admin, with its label and description.
 * Presentational: `ExperimentSwitchField` connects it to the form.
 */
export function ExperimentSwitch({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}): React.ReactNode {
  const descriptionId = description ? `${id}-description` : undefined
  return (
    <div className="experiment-switch">
      <div className="experiment-switch__row">
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => onCheckedChange(next)}
          aria-describedby={descriptionId}
        />
        <label className="experiment-switch__label" htmlFor={id}>
          {label}
        </label>
      </div>
      {description && (
        <div className="experiment-switch__description" id={descriptionId}>
          {description}
        </div>
      )}
    </div>
  )
}
