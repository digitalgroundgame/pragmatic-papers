"use client"

import React from "react"

import { cn } from "@/utilities/utils"

/**
 * A group of toggle buttons with one tab stop: arrow keys move between options and choose
 * them, as a radio group would, without changing the buttons' role for tests and readers.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
}): React.ReactElement {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const idx = options.findIndex((o) => o.value === value)
    let next = idx
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (idx - 1 + options.length) % options.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = options.length - 1
    else return
    e.preventDefault()
    const target = options[next]!
    onChange(target.value)
    for (const b of e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-value]"))
      if (b.dataset.value === target.value) b.focus()
  }
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div
        className="bg-muted/60 border-border inline-flex overflow-hidden rounded-md border p-0.5"
        onKeyDown={onKeyDown}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            data-value={o.value}
            aria-pressed={o.value === value}
            tabIndex={o.value === value ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-ring/60 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
              o.value === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
