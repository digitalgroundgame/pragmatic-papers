import type { User } from "@/payload-types"

/**
 * The only author fields the byline renders.
 *
 * `Byline` is a client component, so React serialises every prop it receives
 * into the RSC payload embedded in the article HTML. Handing it whole `User`
 * documents would ship each author's `biography` (a full Lexical document),
 * `affiliation`, `socials` and entire populated `profileImage` doc to the
 * browser — and, in draft mode, the fields that `overrideAccess` leaves
 * ungated. Narrowing at the boundary keeps the payload to what actually gets
 * drawn.
 */
export interface BylineAuthor {
  id: number
  slug: string
  name?: string | null
  /** `profileImage.sizes.square.url`, resolved on the server. */
  avatarUrl?: string | null
}

/** Narrow a populated `User` to the fields the byline draws. */
export function toBylineAuthor({ id, slug, name, profileImage }: User): BylineAuthor {
  return {
    id,
    slug,
    name,
    avatarUrl:
      typeof profileImage === "object" && profileImage !== null
        ? (profileImage.sizes?.square?.url ?? null)
        : null,
  }
}
