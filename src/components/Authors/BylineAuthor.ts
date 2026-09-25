import type { User } from "@/payload-types"
import { isResolved } from "@/utilities/relationships"

/**
 * The only author fields the byline renders.
 *
 * A populated `User` carries each author's `biography` (a full Lexical
 * document), `affiliation`, `socials` and entire `profileImage` doc — and, in
 * draft mode, the fields that `overrideAccess` leaves ungated. Narrowing at
 * the boundary keeps the byline handling only what it actually draws.
 */
export interface BylineAuthor {
  id: number
  slug: string
  name?: string | null
  avatarUrl?: string | null
}

/** Narrow a populated `User` to the fields the byline draws. */
export function toBylineAuthor({ id, slug, name, profileImage }: User): BylineAuthor {
  return {
    id,
    slug,
    name,
    avatarUrl: isResolved(profileImage) ? (profileImage.sizes?.square?.url ?? null) : null,
  }
}
