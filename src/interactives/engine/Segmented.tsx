"use client"

import type { LucideIcon } from "lucide-react"
import React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export interface SegmentedOption<T extends string> {
  value: T
  /** The accessible name, and what shows on the button unless `icon` replaces it. */
  label: string
  /** Drawn instead of `label`'s text; `label` stays the button's accessible name. */
  icon?: LucideIcon
  /** What a hover or a focus explains about this choice. */
  hint?: React.ReactNode
}

/**
 * One choice out of a few — the pane's View, Mark and seniority controls, and the summary's —
 * as either a labelled row of toggle buttons or, given `variant="select"`, a dropdown: a
 * button's own width has to fit the widest label, and "Alongside" and "Counted" are captions a
 * button reads as wordy where a dropdown just shows the one that's chosen.
 *
 * The controls are the design system's (`ui/toggle-group`, `ui/select`), which bring roving
 * focus and arrow keys, or native select behaviour, with them. Three things are this
 * component's own regardless of variant: the label that says what is being chosen (or, given
 * `labelHint`, a term worth explaining rather than a caption), a hint on any option worth a
 * sentence, and the rule that something always is — a toggle group is otherwise free to end up
 * with nothing pressed, and "no view" is not a view.
 */
export function Segmented<T extends string>({
  label,
  /** Turns the label into a tooltip trigger: what "Senior" means, not merely that it exists. */
  labelHint,
  /** Drops the visible label — the options read on their own — while `label` still names the
      group for anyone not looking at it. */
  hideLabel,
  value,
  options,
  onChange,
  variant = "toggle",
}: {
  label: string
  labelHint?: React.ReactNode
  hideLabel?: boolean
  value: T
  options: SegmentedOption<T>[]
  onChange(v: T): void
  variant?: "toggle" | "select"
}): React.ReactElement {
  return (
    <TooltipProvider delay={300} closeDelay={0}>
      <div className="inline-flex items-center gap-1.5 text-sm">
        {hideLabel ? null : labelHint ? (
          <Tooltip>
            <TooltipTrigger className="text-muted-foreground cursor-help text-xs underline decoration-dotted underline-offset-2">
              {label}
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-56">
              {labelHint}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-xs">{label}</span>
        )}
        {variant === "select" ? (
          <Select value={value} onValueChange={(v) => onChange(v as T)}>
            <SelectTrigger size="sm" aria-label={label}>
              {/* Not the bare `<SelectValue />`: it resolves a value to its label from the
                  options it has seen mounted, and the popup's own options mount lazily on
                  first open — so before that, the trigger would show the raw value ("hide")
                  rather than what the reader chose ("Hidden"). We already have the mapping. */}
              <SelectValue>{options.find((o) => o.value === value)?.label ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => {
                const item = (
                  <SelectItem value={o.value} label={o.label}>
                    {o.label}
                  </SelectItem>
                )
                if (!o.hint) return <React.Fragment key={o.value}>{item}</React.Fragment>
                return (
                  <Tooltip key={o.value}>
                    <TooltipTrigger render={item} />
                    <TooltipContent side="right" align="center" className="max-w-56">
                      {o.hint}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </SelectContent>
          </Select>
        ) : (
          <ToggleGroup
            aria-label={label}
            size="sm"
            spacing={0}
            variant="outline"
            value={[value]}
            // A press that would leave nothing chosen is the reader pressing what is already
            // chosen; the group keeps what it had rather than emptying.
            onValueChange={(next: string[]) => {
              const chosen = (next as T[]).find((v) => v !== value) ?? (next[0] as T | undefined)
              if (chosen) onChange(chosen)
            }}
          >
            {options.map((o) => {
              const Icon = o.icon
              const item = (
                <ToggleGroupItem value={o.value} aria-label={Icon ? o.label : undefined}>
                  {Icon ? <Icon aria-hidden="true" /> : o.label}
                </ToggleGroupItem>
              )
              if (!o.hint) return <React.Fragment key={o.value}>{item}</React.Fragment>
              return (
                <Tooltip key={o.value}>
                  <TooltipTrigger render={item} />
                  <TooltipContent side="top" align="center" className="max-w-56">
                    {o.hint}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </ToggleGroup>
        )}
      </div>
    </TooltipProvider>
  )
}
