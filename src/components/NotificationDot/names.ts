/**
 * Every notification dot on the site, by name. A dot's name is also its storage
 * key, so renaming one shows its dot again to readers who had already seen it.
 * A plain module (not `"use client"`) so server components can import it too.
 */
export const NOTIFICATION_DOTS = {
  /** The theme (light/dark/system) toggle, and the account button that holds it below `lg`. */
  modeToggle: "mode-toggle",
} as const

export type NotificationDotName = (typeof NOTIFICATION_DOTS)[keyof typeof NOTIFICATION_DOTS]
