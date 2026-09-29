/**
 * Everything the site can mark fresh, by name. A name is also its storage key
 * (`pp:seen:<name>`), so renaming one marks it fresh again for readers who had
 * already seen it.
 * A plain module (not `"use client"`) so server components can import it too.
 */
export const FRESH = {
  /** The theme (light/dark/system) toggle, and the account button that holds it below `lg`. */
  modeToggle: "mode-toggle",
} as const

export type FreshName = (typeof FRESH)[keyof typeof FRESH]
