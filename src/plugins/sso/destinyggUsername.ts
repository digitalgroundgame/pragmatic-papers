import type { FieldHook, TextField } from "payload"

/**
 * A Destiny.gg username as it's stored and matched: Destiny.gg treats names without regard
 * to case, and people often paste one with an `@`. Blank is null, so the unique index
 * allows any number of users without one.
 */
export function normalizeDestinyggUsername(value: unknown): string | null {
  if (typeof value !== "string") return null
  const name = value.trim().replace(/^@/, "").toLowerCase()
  return name || null
}

const normalizeOnSave: FieldHook = ({ value }) => normalizeDestinyggUsername(value)

/**
 * The Destiny.gg account a user signs in with. Destiny.gg shares no email address, so an
 * admin names the account here instead of the address doing it.
 */
export const destinyggUsernameField: TextField = {
  name: "destinyggUsername",
  label: "Destiny.gg username",
  type: "text",
  unique: true,
  // Staff only: authors' public records would otherwise show who signs in with it.
  access: { read: ({ req }) => Boolean(req.user) },
  hooks: { beforeValidate: [normalizeOnSave] },
  admin: {
    position: "sidebar",
    description:
      "Lets this person sign in with Destiny.gg. Their first sign-in links that account; after that a rename on Destiny.gg doesn't matter, and clearing this field stops it.",
  },
}
