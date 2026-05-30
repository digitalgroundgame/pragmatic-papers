import type { User } from "@/payload-types"

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const authorSlugFromUser = (user: User): string => {
  const base = user.name || `author-${user.id}`
  return slugify(String(base))
}

export const authorSlugFromNameAndId = (
  name?: string | null,
  id?: string | number | null,
): string => {
  if (name && name.trim()) return slugify(name)
  if (id != null) return slugify(String(id))
  return "author"
}
